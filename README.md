# F3RVA Infrastructure

This is a CDK based project to build all required AWS infrastructure for both the website and bigdata.

WIP.

## Stack specific examples

* `cdk deploy F3RVA-network-dev`                                                              deploy the VPC and supporting network
* `cdk deploy F3RVA-wordpress-dev`                                                            deploy the wordpress dev stack
* `cdk deploy F3RVA-wordpress-dev --parameters F3RVA-wordpress-dev:branch=feature/rds-stack`  deploy the wordpress dev stack by pulling from a branch (helpful for testing purposes)

## Profiles
* `aws configure sso`                                 configures SSO for authenticating in cdk
* `aws sso login`                                     logs in after session expiration
* `cdk deploy F3RVA-network-dev --profile f3rva-dev`  deploy using dev credentials
* `cdk deploy F3RVA-network-dev --profile f3rva-prod` deploy using prod credentials

## Other useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## Notes on each stack

### DNS
This stack creates the Route53 hosted zones to support DNS.  This currently just creates the hosted zone and adds an MX record to receive emails.  Any other DNS needs should be setup in the appropriate stacks.  E.g., if we need a DNS for a web server, add it to the web server stack.

Until everything is migrated over to AWS, there is an A record manually added to Route53 to delegate to another server.  This will need to be removed when necessary.

### Email
This is the stack to setup SES for sending and receiving emails.  We receive emails as we do not have an email provider setup (nor do we need one).  There is simple routing to receive emails in SES and then route them to an SNS topic, subscribed to by a Lambda service, and then forwarded out to a preconfigured email.  This allows us to receive emails for the given domain and forward them to a predefined output email.  

Sounds complex but it really isn't
* SES Receives email -> drops on SNS topic -> subscribed to from Lambda -> sends email back out

Identify verification of the domain and any email addresses need to be done manually as it requires specific CNAME records or email verification.  See SES documentation for this info.

One small note on troubleshooting.  If the SES instance isn't in "production mode" then the behavior for sending emails is a little different, and may not work for your use case.  Make sure SES is enabled for "production access" by following the SES instructions.

If we ever really have more complex email needs, it's all here, just need to configure it.

### Network
This creates the VPC infrastructure for everything else in the account that needs it.  Only the core networking should go here, any dependent service needs should be in that specific stack.

### Certificates
This stack creates the baseline certificates needed for each domain.  The wildcard certificate is currently the only certificate created.

### Storage
This stack creates the filesystem needs for the environment.  Wordpress requires persistent storage to be maintained across stack recreation so we will manage this in EFS.

### EC2
A prerequisite for creating the EC2s is to create a key pair to allow SSH access after creation.  Use the following command to create the key pair via the CLI, this outputs the private key which you will have to save in a .pem file.  If you don't save it, you will have to create a new key pair.

* `aws ec2 create-key-pair --key-name f3rva-dev-wordpress-key-pair --key-type rsa --key-format pem --region us-east-1 --profile f3rva-dev`
* save it in a .pem file
* `chmod 400 *.pem`