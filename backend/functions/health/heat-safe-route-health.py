import json

def lambda_handler(event, context):
    return {
        "statusCode": 200, 
        "headers": {
        "Content-Type": "application/json"
        },

        "body": json.dumps({
            "status": "ok",
            "service": "heat-safe-route-planner",
            "message": "AWS lambda is working",
        })
    }