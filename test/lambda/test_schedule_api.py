import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add src/lambda/schedule_api to path for importing handler
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../src/lambda/schedule_api")))

import handler as schedule_handler


class TestScheduleApiHandler(unittest.TestCase):

    def test_slugify(self):
        self.assertEqual(schedule_handler.slugify("The Alamo!"), "the-alamo")
        self.assertEqual(schedule_handler.slugify("  45 Minutes of Mary  "), "45-minutes-of-mary")
        self.assertEqual(schedule_handler.slugify("Satan's Hill"), "satans-hill")

    def test_transform_events_to_workouts(self):
        sample_events = [
            {
                "id": 101,
                "name": "The Alamo",
                "description": "Meet in the clubhouse parking lot",
                "dayOfWeek": "monday",
                "startTime": "0530",
                "endTime": "0615",
                "locationName": "RounTrey Clubhouse",
                "locationAddress": "123 Main St",
                "locationCity": "Midlothian",
                "locationState": "VA",
                "locationZip": "23112",
                "eventTypes": [{"eventTypeName": "Bootcamp"}],
                "meta": {"siteQ": "Vagabond"},
            }
        ]

        workouts = schedule_handler.transform_events_to_workouts(sample_events)
        self.assertEqual(len(workouts), 1)
        w = workouts[0]
        self.assertEqual(w["name"], "The Alamo")
        self.assertEqual(w["location"], "RounTrey Clubhouse")
        self.assertEqual(w["tagURL"], "/archives/ao/the-alamo/")
        self.assertEqual(w["dayOfWeek"], "Monday")
        self.assertEqual(w["startTime"], "0530")
        self.assertEqual(w["endTime"], "0615")
        self.assertEqual(w["workoutStyle"], "Bootcamp")
        self.assertEqual(w["siteQ"], "Vagabond")
        self.assertEqual(w["notes"], "Meet in the clubhouse parking lot")
        self.assertIn("123%20Main%20St", w["locationURL"])

    def test_handler_cors_preflight(self):
        event = {"requestContext": {"http": {"method": "OPTIONS"}}}
        res = schedule_handler.handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        self.assertEqual(res["headers"]["Access-Control-Allow-Origin"], "*")

    @patch.dict(os.environ, {"F3_NATION_API_KEY": "test-key", "F3_REGION_ID": "25240"})
    @patch("urllib.request.urlopen")
    def test_handler_success(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "events": [
                {
                    "name": "DaPile",
                    "dayOfWeek": "saturday",
                    "startTime": "0630",
                    "endTime": "0730",
                    "locationName": "Atlee High School",
                    "eventTypes": [{"eventTypeName": "Bootcamp"}],
                }
            ]
        }).encode("utf-8")
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        event = {"requestContext": {"http": {"method": "GET"}}}
        res = schedule_handler.handler(event, None)

        self.assertEqual(res["statusCode"], 200)
        self.assertEqual(res["headers"]["Cache-Control"], "public, max-age=900, s-maxage=900")
        body = json.loads(res["body"])
        self.assertIn("1stF", body)
        self.assertEqual(len(body["1stF"]), 1)
        self.assertEqual(body["1stF"][0]["name"], "DaPile")

    @patch.dict(os.environ, {}, clear=True)
    @patch.object(schedule_handler, "get_api_key", return_value=None)
    def test_handler_missing_api_key(self, mock_get_key):
        event = {"requestContext": {"http": {"method": "GET"}}}
        res = schedule_handler.handler(event, None)
        self.assertEqual(res["statusCode"], 500)
        self.assertIn("error", json.loads(res["body"]))

    @patch.dict(os.environ, {"F3_NATION_API_KEY": "test-key"})
    @patch("urllib.request.urlopen", side_effect=Exception("Connection reset"))
    def test_handler_api_error(self, mock_urlopen):
        event = {"requestContext": {"http": {"method": "GET"}}}
        res = schedule_handler.handler(event, None)
        self.assertEqual(res["statusCode"], 502)
        self.assertIn("error", json.loads(res["body"]))


if __name__ == "__main__":
    unittest.main()
