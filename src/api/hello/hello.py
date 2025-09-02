import json

def lambda_handler(event, context):
    payload = json.loads(event['body'])

    response = {}
    response['message'] = 'Yo {} {}!'.format(payload['post']['first_name'], payload['post']['last_name'])
    
    print('response: ' + json.dumps(response))
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps(response)
    }