# HeatSafe Route Planner

Climate-aware pedestrian navigation platform that compares fastest walking paths against shade- and cooling-refuge-optimized routes using live thermal, UV, wind, and community Cool Spot telemetry.

---

## Architecture Overview

| Layer | Technology / Service | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript 6, Vite 8, Leaflet (`react-leaflet`) | Gated auth UI, interactive route comparison map, weather/UV widgets, Cool Spots map & moderation UI, Mappy assistant |
| **Hosting** | AWS Amplify Hosting (`frontend/` monorepo root) | Builds `frontend/dist` and serves the SPA |
| **API Layer** | Amazon API Gateway (`heat-safe-route-api`, REST) | Exposes `/auth/*`, `/plan-route`, `/cool-spots*`, `/admin/cool-spots*`, `/health`, `/heat-score` with custom JWT TOKEN authorization |
| **Compute** | AWS Lambda (Python 3.14) | `heat-safe-auth`, `heat-safe-authorizer`, `heat-safe-planner`, `heat-safe-cool-spots`, `heat-safe-route-health`, `heat-safe-score`, `heat-safe-routes`, `heat-safe-weather`, plus `backend/functions/mappy` |
| **Data & Media** | Amazon DynamoDB & Amazon S3 | `HeatSafe_Users`, `HeatSafe_Sessions`, `HeatSafe_CoolSpots`, `HeatSafe_SpotRequests`, `HeatSafe_RoutePlans`; `heatsafe-coolspots-media` bucket |
| **Secrets & Email** | AWS SSM Parameter Store, Gmail SMTP / Amazon SES | Stores JWT signing secret, LWA client secret, and SMTP App Password (`SecureString`); delivers 6-digit 2FA OTP emails |

---

## Core Functionalities

### 1. Gated Authentication, RBAC & 6-Digit Email 2FA
- **Mandatory Auth Gate (`AuthPage.tsx`, `AuthFormPanel.tsx`, `AuthContext.tsx`)**: Visitors must sign in or register before accessing route planning or Cool Spot workflows.
- **Email + Password with Mandatory 2FA OTP (`POST /auth/register`, `POST /auth/login`, `POST /auth/verify-otp`, `POST /auth/resend-otp`)**:
  - Passwords require at least 12 characters and are hashed with `scrypt`.
  - Registering or signing in dispatches a 6-digit numeric OTP to the user's email (10-minute expiry, 60-second resend cooldown, max 5 attempts per challenge) and returns a signed short-lived challenge token.
  - Access/refresh tokens are issued only after `/auth/verify-otp` validates the code and marks `email_verified = true`.
  - Supports **Gmail SMTP** (`smtp.gmail.com:465` using an SSM-backed App Password) and **Amazon SES** (`email_otp.py`).
- **Login with Amazon (`POST /auth/amazon`)**:
  - Uses OAuth 2.0 Authorization Code Grant with PKCE (`S256`).
  - Exchanges codes server-side (`amazon_lwa.py`), preserves existing DynamoDB `role` (`user` or `admin`), and safely links local + Amazon providers on matching verified email without overwriting `password_hash`.
- **Stateless JWT + Rotating Sessions & Authorizer (`authorizer/lambda_function.py`)**:
  - Issues short-lived HS256 JWT access tokens (`600s` default) and opaque rotating refresh tokens (`2592000s` default) stored hashed in `HeatSafe_Sessions` (mapping `session_id` to DynamoDB key `session_Id`).
  - API Gateway TOKEN authorizer enforces valid Bearer JWTs and restricts `POST /cool-spots` and `/admin/*` endpoints strictly to `role == "admin"`.

### 2. Heat-Safe Pedestrian Routing & Thermal Analytics
- **Alternative Route Comparison (`planner/lambda_function.py`, `RouteCard.tsx`, `RouteAnalytics.tsx`)**:
  - Queries OpenRouteService (`foot-walking`) and live weather feeds to compare standard fastest routes against heat-safe pedestrian paths.
  - Evaluates exposure using ambient temperature, humidity, wind cooling, UV index (`WeatherWidget.tsx`), and walking duration (`heat_safe_score.py`), categorizing exposure as `Low`, `Moderate`, `High`, or `Very High`.
  - Logs planned route records to DynamoDB (`HeatSafe_RoutePlans`).

### 3. Community Cool Spots & Admin Moderation Portal
- **Map Refuges & Nominations (`CoolSpotMapLayer.tsx`, `CoolSpotPortal.tsx`, `cool_spots/`)**:
  - Displays verified canopy parks, hydration stations (`pyau`), and shaded refuges on the interactive Leaflet map.
  - Authenticated users can nominate new Cool Spots (`POST /cool-spots/requests`) with coordinates, cooling category, description, and validated JPEG/PNG/WebP images uploaded with AES-256 encryption to S3 (`MediaService`).
- **Admin Moderation Dashboard (`GET/PATCH /admin/cool-spots*`)**:
  - Admins review community submissions across `PENDING`, `APPROVED`, `REJECTED`, and `ALL` tabs synced directly with DynamoDB, and create/edit/delete published spots directly in `HeatSafe_CoolSpots`.
  - Includes automatic access-token refresh retry handling on `401` inside `plannerApi.ts`.

### 4. Mappy AI & Voice Assistant
- **Route Companion (`MappyAssistant.tsx`, `backend/functions/mappy/`)**:
  - Gemini-backed assistant supporting text queries, optional hands-free voice transcripts, GPS location awareness, and shade/hydration detour suggestions near active walking segments.

---

## Repository Structure

```text
heat-safe-route-planner/
├── backend/
│   ├── functions/
│   │   ├── auth/            # Register, login, 2FA OTP verify/resend, LWA, refresh, logout, /auth/me
│   │   ├── authorizer/      # API Gateway REST TOKEN authorizer (JWT + RBAC enforcement)
│   │   ├── cool_spots/      # Modularized Cool Spots Lambda (config, http, validation, repositories, services)
│   │   ├── planner/         # Multi-route heat-aware pedestrian routing + RoutePlans persistence
│   │   ├── mappy/           # Backend Mappy AI agent & Gemini/deterministic providers
│   │   ├── heat_score/      # Standalone heat exposure scoring Lambda
│   │   ├── routes/          # Route geometry helper Lambda
│   │   ├── weather/         # Weather telemetry Lambda
│   │   └── health/          # Health check Lambda
│   ├── shared/
│   │   ├── auth/            # Shared config, tokens, scrypt passwords, LWA client, DynamoDB repo, email_otp, HTTP helpers
│   │   └── aws/             # SSM Parameter Store SecureString loader
│   └── tests/               # Unit tests for auth, authorizer, repository, tokens, cool_spots, heat model, ranking, mappy
├── frontend/
│   ├── src/
│   │   ├── api/             # authApi.ts, plannerApi.ts
│   │   ├── components/      # AuthPage, AuthFormPanel, AuthModal, authBar, Map, RouteControls, RouteCard, CoolSpot*, MappyAssistant, WeatherWidget
│   │   ├── config/          # supportedCities.ts (Indore bounds), indoreCoolSpots.ts
│   │   ├── context/         # AuthContext.tsx (session state, PKCE callback, OTP challenge state, BroadcastChannel sync)
│   │   ├── types/           # auth.ts, route.ts, coolSpot.ts
│   │   └── utils/           # locationValidation.ts
│   ├── package.json
│   └── vite.config.ts
├── infrastructure/
│   ├── auth-storage.yaml
│   ├── cool-spots-storage.yaml
│   └── iam/                 # Least-privilege IAM policy templates
├── scripts/                 # Lambda zip packaging & AWS setup helper scripts
├── requirements-auth.txt    # Runtime auth dependencies (PyJWT)
└── readme.md
```

---

## Configuration & Setup

### Frontend Environment Variables (`frontend/.env` / AWS Amplify Hosting)
| Variable | Required | Description |
| :--- | :---: | :--- |
| `VITE_API_BASE_URL` | Yes | Deployed API Gateway stage URL (e.g. `https://<api-id>.execute-api.us-east-1.amazonaws.com/dev`) |
| `VITE_AMAZON_CLIENT_ID` | For LWA | Amazon Security Profile OAuth2 Client ID |
| `VITE_GEMINI_API_KEY` *(or `VITE_GOOGLE_API_KEY`)* | For Mappy | Gemini API key used by `MappyAssistant` |
| `VITE_GEMINI_MODEL` | Optional | Gemini model override (e.g. `gemini-3.8-flash`) |
| `VITE_WEATHER_API_URL` | Optional | Weather endpoint override (defaults to `https://api.open-meteo.com/v1/forecast`) |

### Backend Auth Lambda (`heat-safe-auth`) Environment Variables & SSM
- **SSM Parameters (`SecureString`)**:
  - `/heatsafe/auth/jwt-signing-key` (>= 32-byte HS256 secret)
  - `/heatsafe/auth/amazon-client-secret` (Amazon LWA client secret)
  - `/heatsafe/auth/smtp-password` *(required when using Gmail SMTP for OTP delivery)*
- **Core Env Vars**:
  - `AUTH_USERS_TABLE=HeatSafe_Users`, `AUTH_SESSIONS_TABLE=HeatSafe_Sessions`
  - `HEATSAFE_JWT_SECRET_PARAMETER`, `HEATSAFE_JWT_ISSUER`, `HEATSAFE_JWT_AUDIENCE`
  - `ALLOWED_ORIGINS` (comma-separated origins, e.g. `http://localhost:5173,https://<app>.amplifyapp.com`)
  - `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET_PARAMETER`, `AMAZON_ALLOWED_REDIRECT_URIS`
  - `OTP_SENDER_EMAIL`, `OTP_TTL_SECONDS` (`600`), `OTP_RESEND_COOLDOWN_SECONDS` (`60`), `OTP_MAX_ATTEMPTS` (`5`)
  - Optional SMTP fallback overrides: `SMTP_HOST` (`smtp.gmail.com`), `SMTP_PORT` (`465`), `SMTP_USER`, `SMTP_PASSWORD_PARAMETER`

### Local Commands
```bash
# Frontend dev server & production build (Node 20+ recommended for Vite 8 / TS 6)
cd frontend
npm ci
npm run dev
npm run build

# Python syntax verification & packaging (PowerShell on Windows)
python -m compileall -q backend
./scripts/package-auth-lambdas.ps1
./scripts/package-cool-spots-lambda.ps1
```

---

## Bugs & Technical Debt to Resolve Later

1. **Wildcard CORS & Unauthenticated Routing on `heat-safe-planner`**
   - `backend/functions/planner/lambda_function.py` still returns `Access-Control-Allow-Origin: *` rather than validating `ALLOWED_ORIGINS` dynamically like `auth` and `cool_spots`.
   - Route planning endpoints (`POST /plan-route`) should be attached to the custom JWT authorizer cleanly once legacy callers are migrated.
2. **Missing CORS Header in `heat-safe-route-health.py`**
   - `backend/functions/health/heat-safe-route-health.py` returns only `Content-Type: application/json` in the Lambda payload; if API Gateway `GET /health` doesn't inject CORS headers at the integration level, cross-origin health probes from Amplify can fail.
3. **Client-Side Gemini API Key in `MappyAssistant.tsx`**
   - `MappyAssistant.tsx` reads `VITE_GEMINI_API_KEY` in the browser (plus `localStorage`), which embeds the key into client bundles. All Gemini calls should be proxied exclusively through the server-side `backend/functions/mappy` Lambda.
4. **Offline Fallback Cache Drift in `plannerApi.ts`**
   - `plannerApi.ts` contains seeded `DEFAULT_COOL_SPOTS` and `localStorage` caches; while useful when developing offline, transient network errors can temporarily show stale or fallback data instead of surfacing an explicit sync warning.
5. **No Unified IaC Pipeline / `amplify.yml` in Repo**
   - Auth and Cool Spots storage stacks live in separate YAML templates (`infrastructure/`), while Lambda code/env updates (`ALLOWED_ORIGINS`, `AMAZON_ALLOWED_REDIRECT_URIS`) are deployed via packaging scripts/CLI rather than an AWS SAM/CDK/Terraform stack, and Amplify relies on console monorepo settings (`AMPLIFY_MONOREPO_APP_ROOT=frontend`) instead of a checked-in `amplify.yml`.
6. **Root Workspace & Unpackaged Microservice Hygiene**
   - Several auxiliary functions (`backend/functions/mappy`, `heat_score`, `routes`, `weather`, `health`) lack dedicated packaging scripts matching `package-auth-lambdas.ps1`, and legacy troubleshooting markdown files / local build zips in the repo root should be archived into `docs/` or removed.

---

## Current Limitations

- **Single Supported City (`supportedCities.ts`)**: Routing bounds and default Cool Spot datasets are currently configured only for **Indore, Madhya Pradesh** (`22.6–22.85° N`, `75.75–75.98° E`). Expanding to new cities requires adding bounding boxes, validation rules, and regional Cool Spot seed data.
- **Email 2FA Sending Ceiling (Gmail SMTP vs. SES Production)**: Amazon SES in `us-east-1` is currently in **Sandbox mode** because AWS requires a verified custom domain with DNS DKIM records before unlocking **Production Access**. Until a custom domain is configured, OTP delivery runs via **Gmail SMTP**, which is subject to consumer Gmail daily limits (~500 emails/day) and burst throttling.
- **Manual Admin Role Promotion**: Public sign-up and Login with Amazon strictly assign `role: "user"`. Promoting an account to `"admin"` currently requires editing the user's `role` attribute directly in `HeatSafe_Users` (DynamoDB Console or AWS CLI); there is no in-app admin management UI yet.
- **No WAF / CAPTCHA on Public Auth Endpoints**: While `/auth/verify-otp` enforces a 60-second resend cooldown and 5-attempt lockout, `/auth/register` and `/auth/login` rely on standard API Gateway quotas without CAPTCHA or per-IP WAF rate rules.
- **S3 Direct Media URLs**: `MediaService` uploads AES-256 encrypted images to `heatsafe-coolspots-media` and stores direct `https://<bucket>.s3.<region>.amazonaws.com/<key>` URLs rather than serving via CloudFront signed URLs or API-generated pre-signed GET URLs.
- **Browser Capability Dependency for Live Telemetry**: Hands-free voice wake-word/dictation and live off-route GPS checks in `MappyAssistant` depend on browser support and granted permissions for Web Speech API and Geolocation.
