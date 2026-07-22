import json
import os
import re
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

try:
    import boto3
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False


def slugify(text: str) -> str:
    """Convert a string to a URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text.strip('-')


def get_api_key() -> Optional[str]:
    """Retrieve F3 Nation API Key from environment or SSM Parameter Store."""
    api_key = os.environ.get("F3_NATION_API_KEY")
    if api_key:
        return api_key

    ssm_param_name = os.environ.get("SSM_PARAM_NAME", "/f3rva/dev/f3nation_api_key")
    if HAS_BOTO3 and ssm_param_name:
        try:
            ssm = boto3.client("ssm")
            response = ssm.get_parameter(Name=ssm_param_name, WithDecryption=True)
            return response["Parameter"]["Value"]
        except Exception as err:
            print(f"Error fetching SSM parameter {ssm_param_name}: {err}")
    return None


def transform_events_to_workouts(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Transform F3 Nation API events to Workout objects expected by f3rva-website."""
    workouts = []
    for event in events:
        name = event.get("name", "")
        location_name = event.get("locationName") or event.get("locationAddress") or "TBD"

        # Build full address string for Google Maps search
        address_parts = [
            event.get("locationAddress"),
            event.get("locationCity"),
            event.get("locationState"),
            event.get("locationZip"),
        ]
        address_str = ", ".join(p for p in address_parts if p)
        if not address_str:
            address_str = location_name

        location_url = f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(address_str)}"
        tag_url = f"/archives/ao/{slugify(name)}/"
        day_of_week = (event.get("dayOfWeek") or "").capitalize()

        # Extract workout style from eventTypes
        event_types = event.get("eventTypes") or []
        workout_style = event_types[0].get("eventTypeName", "") if event_types else ""

        # Extract siteQ if stored in metadata
        meta = event.get("meta") or {}
        site_q = meta.get("siteQ", "") if isinstance(meta, dict) else ""

        workouts.append({
            "location": location_name,
            "locationURL": location_url,
            "name": name,
            "tagURL": tag_url,
            "dayOfWeek": day_of_week,
            "startTime": event.get("startTime", "") or "",
            "endTime": event.get("endTime", "") or "",
            "workoutStyle": workout_style,
            "siteQ": site_q,
            "notes": event.get("description", "") or "",
        })

    return workouts


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """AWS Lambda entry point for F3 RVA Schedule API proxy."""
    # CORS preflight handling
    http_method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod")
    if http_method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Client",
            },
            "body": "",
        }

    region_id = os.environ.get("F3_REGION_ID", "25240")
    client_id = os.environ.get("CLIENT_ID", "f3rva-website")
    api_key = get_api_key()

    if not api_key:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": "F3 Nation API Key not configured"}),
        }

    api_url = f"https://api.f3nation.com/v1/event?regionIds={region_id}&statuses=active&pageSize=200"
    req = urllib.request.Request(
        api_url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Client": client_id,
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            events = data.get("events", [])
            workouts = transform_events_to_workouts(events)

            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=900, s-maxage=900",
                },
                "body": json.dumps({"1stF": workouts}),
            }
    except Exception as err:
        print(f"Error calling F3 Nation API: {err}")
        return {
            "statusCode": 502,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": "Failed to fetch schedule from F3 Nation API"}),
        }
