"""Email delivery helper for 6-digit OTP 2FA codes via Amazon SES or SMTP."""
from __future__ import annotations

import smtplib
from email.message import EmailMessage

import boto3
from botocore.exceptions import ClientError

from backend.shared.aws.parameter_store import get_parameter_value


class OtpDeliveryError(RuntimeError):
    """Raised when the 6-digit verification code cannot be dispatched."""


def send_otp_email(
    *,
    recipient_email: str,
    otp_code: str,
    purpose: str,
    config: dict,
    ttl_minutes: int = 10,
) -> None:
    """Send a 6-digit verification code using SMTP (if configured) or Amazon SES."""
    sender = str(config.get("otp_sender_email") or "").strip()
    if not sender:
        raise OtpDeliveryError("OTP_SENDER_EMAIL is not configured on auth service")

    action_label = "account registration" if purpose == "register" else "sign-in verification"
    subject = f"HeatSafe Verification Code: {otp_code}"
    text_body = (
        f"Hello,\n\n"
        f"Your 6-digit HeatSafe {action_label} code is:\n\n"
        f"    {otp_code}\n\n"
        f"This code expires in {ttl_minutes} minutes.\n"
        f"If you did not request this code, you can safely ignore this email.\n\n"
        f"— HeatSafe Route Planner"
    )
    html_body = (
        f"<div style=\"font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;"
        f"background:#fefae0;color:#01472e;border-radius:16px;border:1px solid rgba(1,71,46,0.2);\">"
        f"<h2 style=\"margin:0 0 8px;letter-spacing:1px;\">HEATSAFE VERIFICATION</h2>"
        f"<p style=\"margin:0 0 18px;font-size:14px;\">Enter this 6-digit code to complete your "
        f"{action_label}:</p>"
        f"<div style=\"font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;"
        f"background:#e9edc9;padding:16px;border-radius:12px;margin-bottom:18px;\">{otp_code}</div>"
        f"<p style=\"margin:0;font-size:12px;opacity:0.8;\">Expires in {ttl_minutes} minutes. "
        f"Do not share this code with anyone.</p>"
        f"</div>"
    )

    smtp_user = str(config.get("smtp_user") or "").strip()
    smtp_param = str(config.get("smtp_password_parameter") or "").strip()
    region = str(config.get("region") or "us-east-1")

    if smtp_user and smtp_param:
        _send_via_smtp(
            smtp_host=str(config.get("smtp_host") or "smtp.gmail.com"),
            smtp_port=int(config.get("smtp_port") or 465),
            smtp_user=smtp_user,
            smtp_password=get_parameter_value(smtp_param, region, min_bytes=1),
            sender=sender,
            recipient=recipient_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        return

    _send_via_ses(
        region=region,
        sender=sender,
        recipient=recipient_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )


def _send_via_ses(
    *,
    region: str,
    sender: str,
    recipient: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> None:
    ses = boto3.client("ses", region_name=region)
    try:
        ses.send_email(
            Source=sender,
            Destination={"ToAddresses": [recipient]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": text_body, "Charset": "UTF-8"},
                    "Html": {"Data": html_body, "Charset": "UTF-8"},
                },
            },
        )
    except ClientError as exc:
        err = exc.response.get("Error", {})
        code = err.get("Code", "Unknown")
        message = err.get("Message", "")
        print(f"Auth SES ClientError: code={code} message={message}")
        if code == "MessageRejected" and "not verified" in message.lower():
            raise OtpDeliveryError(
                "AWS SES is in Sandbox mode and this recipient email is not verified yet. "
                "Verify this email in Amazon SES, request SES Production Access, or configure Gmail SMTP."
            ) from exc
        raise OtpDeliveryError(f"Failed to send verification email via SES ({code}).") from exc


def _send_via_smtp(
    *,
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    sender: str,
    recipient: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender or smtp_user
    msg["To"] = recipient
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
    except Exception as exc:
        print(f"Auth SMTP error: {type(exc).__name__}")
        raise OtpDeliveryError("Failed to send verification email via SMTP.") from exc
