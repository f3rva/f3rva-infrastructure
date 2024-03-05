import base64
import boto3
import email
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import json
from email.policy import default as default_policy

def get_value_from_header(headers, key):
  value = None
  for header in headers:
    if header['name'] == key:
      value = header['value']
      break
  
  return value

def lambda_handler(event, context):
  # Get the SNS message body
  incoming_message = event['Records'][0]['Sns']['Message']
  
  # Parse the JSON message
  message_data = json.loads(incoming_message)
  
  # extract key fields from the list of headers
  headers = message_data['mail']['headers']
  sender = get_value_from_header(headers, 'From')
  receiver = get_value_from_header(headers, 'To')
  subject = get_value_from_header(headers, 'Subject')
  print(f"From: {sender}")
  print(f"To: {receiver}")
  print(f"Subject: {subject}")
  
  # the decoded content is in raw email format
  decoded_content = base64.b64decode(message_data['content'])
  raw_email = email.message_from_bytes(decoded_content, policy=default_policy)
  body = raw_email.get_body(preferencelist=('html', 'body'))
  charset = body.get_content_charset()

  # forward the email out  
  try:
    # Replace with your sender and recipient email addresses
    recipient = 'bbischoff78@gmail.com'
    
    # Create the new email content
    new_email_subject = f"[Forwarded from {sender} to {receiver}] {subject}"

    # Configure SES client
    client = boto3.client('ses')
    
    # Create a MIMEMultipart message and set necessary headers
    message = MIMEMultipart('alternative')
    message['From'] = receiver
    message['To'] = recipient
    message['Original-Sender'] = sender
    message['Subject'] = new_email_subject
  
    # Create the HTML part and attach it to the message
    html_part = MIMEText(body.get_content(), 'html')
    message.attach(html_part)
  
    # Convert the message to a string for sending with SES
    message_string = message.as_string()
  
    # Send the email using SES
    try:
      response = client.send_raw_email(
        Destinations=[
          recipient,
        ],
        RawMessage={
          'Data': message_string.encode('utf-8'),
        },
        Source=receiver
      )
      print(f"Email sent successfully. Message ID: {response['MessageId']}")
    except Exception as e:
      print(f"Error sending email: {e}")
      raise e
  
  except json.JSONDecodeError as e:
    print("Error parsing JSON:", e)
  
