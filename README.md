# F3RVA Infrastructure

This is a CDK based project to build all required AWS infrastructure for both the website and bigdata.

WIP.

## Stack specific examples

* `cdk deploy F3RVA-network`                                                                  deploy the VPC and supporting network
* `cdk deploy F3RVA-wordpress-dev`                                                            deploy the wordpress dev stack
* `cdk deploy F3RVA-wordpress-dev --parameters F3RVA-wordpress-dev:branch=feature/rds-stack`  deploy the wordpress dev stack by pulling from a branch (helpful for testing purposes)

## Other useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

