import base64
import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add src/lambda/email_forward to path for importing handler
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../src/lambda/email_forward")))

# Mock boto3 module locally to avoid ModuleNotFoundError when running tests
from unittest.mock import MagicMock
sys.modules['boto3'] = MagicMock()

import handler as email_handler


class TestEmailForwardHandler(unittest.TestCase):

    def setUp(self):
        # Sample raw email content (multipart/HTML)
        self.raw_email_text = (
            "From: sender@test.com\n"
            "To: receiver@test.com\n"
            "Subject: Test Inbound Subject\n"
            "MIME-Version: 1.0\n"
            "Content-Type: text/html; charset=utf-8\n\n"
            "<h1>Hello, World!</h1>"
        )
        self.encoded_content = base64.b64encode(self.raw_email_text.encode('utf-8')).decode('utf-8')

        # Mock SNS event payload
        self.sns_message = {
            "mail": {
                "headers": [
                    {"name": "From", "value": "sender@test.com"},
                    {"name": "To", "value": "receiver@test.com"},
                    {"name": "Subject", "value": "Test Inbound Subject"},
                ]
            },
            "content": self.encoded_content
        }

        self.event = {
            "Records": [
                {
                    "Sns": {
                        "Message": json.dumps(self.sns_message)
                    }
                }
            ]
        }

    def test_get_value_from_header(self):
        headers = [
            {"name": "From", "value": "sender@test.com"},
            {"name": "Subject", "value": "Test Inbound Subject"}
        ]
        self.assertEqual(email_handler.get_value_from_header(headers, "From"), "sender@test.com")
        self.assertEqual(email_handler.get_value_from_header(headers, "Subject"), "Test Inbound Subject")
        self.assertIsNone(email_handler.get_value_from_header(headers, "To"))

    @patch.dict(os.environ, {"EMAIL_DESTINATION": "forwarded@destination.com"})
    @patch("boto3.client")
    def test_handler_success(self, mock_boto_client):
        mock_ses = MagicMock()
        mock_ses.send_raw_email.return_value = {"MessageId": "test-message-id-123"}
        mock_boto_client.return_value = mock_ses

        # Invoke handler
        email_handler.handler(self.event, None)

        # Assert SES client was instantiated and send_raw_email was called
        mock_boto_client.assert_called_with("ses")
        mock_ses.send_raw_email.assert_called_once()
        
        # Verify destinations and source parameters
        kwargs = mock_ses.send_raw_email.call_args[1]
        self.assertEqual(kwargs["Destinations"], ["forwarded@destination.com"])
        self.assertEqual(kwargs["Source"], "receiver@test.com")
        self.assertIn(b"forwarded@destination.com", kwargs["RawMessage"]["Data"])

    @patch.dict(os.environ, {"EMAIL_DESTINATION": "forwarded@destination.com"})
    @patch("boto3.client")
    def test_handler_ses_failure(self, mock_boto_client):
        mock_ses = MagicMock()
        mock_ses.send_raw_email.side_effect = Exception("SES Throttle Limit Exceeded")
        mock_boto_client.return_value = mock_ses

        # Assert that the exception is bubbled up
        with self.assertRaises(Exception) as context:
            email_handler.handler(self.event, None)
        
        self.assertIn("SES Throttle Limit Exceeded", str(context.exception))

    @patch.dict(os.environ, {"EMAIL_DESTINATION": "forwarded@destination.com"})
    def test_handler_invalid_json(self):
        # Event with invalid JSON body in SNS message
        invalid_event = {
            "Records": [
                {
                    "Sns": {
                        "Message": "{invalid-json}"
                    }
                }
            ]
        }
        
        # Should catch JSONDecodeError gracefully without bubbling up
        try:
            email_handler.handler(invalid_event, None)
        except Exception as e:
            self.fail(f"Handler raised exception on invalid JSON: {e}")


if __name__ == "__main__":
    unittest.main()
