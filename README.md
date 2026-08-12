# F3RVA Infrastructure

This is a CDK based project to build all required AWS infrastructure for both the website, bigdata, and REST APIs.

## Setup
Execution of these stacks requires environment variables defined in your shell environment
(e.g. `.zshrc`). The environment variables should be defined as follows:

```bash
export F3RVA_ACCOUNT_DEV=123456789012
export F3RVA_ACCOUNT_PROD=987654321098
```

## Stack specific examples

* `cdk deploy F3RVA-network-dev`                                                              deploy the VPC and supporting network
* `cdk deploy F3RVA-api-dev`                                                                  deploy the unified REST API & CloudFront distribution
* `cdk deploy F3RVA-wordpress-dev`                                                            deploy the wordpress dev stack
* `cdk deploy F3RVA-wordpress-dev --parameters F3RVA-wordpress-dev:branch=feature/rds-stack`  deploy the wordpress dev stack by pulling from a branch (helpful for testing purposes)

## Profiles
* `aws configure sso`                                 configures SSO for authenticating in cdk
* `aws sso login`                                     logs in after session expiration
* `cdk deploy F3RVA-api-dev --profile f3rva-dev`      deploy using dev credentials
* `cdk deploy F3RVA-api-prod --profile f3rva-prod`    deploy using prod credentials

## Other useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

---

## AWS Systems Manager (SSM) Parameter Store Configuration

The REST API (`f3rva-api`) strictly follows 12-factor architecture and loads secrets and configuration from AWS SSM Parameter Store. The following parameters must be provisioned in your AWS account for each environment (`dev` and `prod`):

### Required SSM Parameters

| Parameter Name (SSM Path) | Type | Purpose | Example Value (`dev`) | Example Value (`prod`) |
| :--- | :--- | :--- | :--- | :--- |
| **`/f3rva/{env}/database_url`** | `SecureString` | Full MySQL connection string with PyMySQL driver | `mysql+pymysql://app_user:pass@f3rva-dev.xyz.us-east-1.rds.amazonaws.com:3306/f3rva_bd?charset=utf8mb4` | `mysql+pymysql://app_user:pass@f3rva-prod.xyz.us-east-1.rds.amazonaws.com:3306/f3rva_bd?charset=utf8mb4` |
| **`/f3rva/{env}/jwt_secret_key`** | `SecureString` | 32+ character cryptographic secret for signing 24h JWT tokens | `dev-secret-key-32-chars-long-abc12345` | `prod-super-secure-random-jwt-key-987654` |
| **`/f3rva/{env}/admin_username`** | `String` | Username for admin authentication endpoint (`POST /v2/admin/login`) | `admin` | `admin` (or custom) |
| **`/f3rva/{env}/admin_password`** | `SecureString` | Password for admin authentication endpoint (`POST /v2/admin/login`) | `dev-admin-password-123!` | `prod-admin-strong-password-456#` |
| **`/f3rva/{env}/f3nation_api_key`** | `SecureString` | Upstream API key for `api.f3nation.com` *(Existing parameter)* | `f3nation-dev-api-key` | `f3nation-prod-api-key` |
| **`/f3rva/{env}/f3_region_id`** *(Optional)* | `String` | Region ID for Richmond VA (defaults to `25240`) | `25240` | `25240` |

### AWS CLI Helper Commands to Create Parameters

#### Development Environment (`dev`):
```bash
# 1. Database Connection URL
aws ssm put-parameter \
  --name "/f3rva/dev/database_url" \
  --value "mysql+pymysql://<user>:<password>@<dev-rds-host>:3306/f3rva_bd?charset=utf8mb4" \
  --type "SecureString" \
  --overwrite

# 2. JWT Signing Key (Generate a random 32-character string)
aws ssm put-parameter \
  --name "/f3rva/dev/jwt_secret_key" \
  --value "$(openssl rand -hex 32)" \
  --type "SecureString" \
  --overwrite

# 3. Admin Username & Password
aws ssm put-parameter \
  --name "/f3rva/dev/admin_username" \
  --value "admin" \
  --type "String" \
  --overwrite

aws ssm put-parameter \
  --name "/f3rva/dev/admin_password" \
  --value "your-secure-dev-password" \
  --type "SecureString" \
  --overwrite

# 4. F3 Nation API Key (if not already present)
aws ssm put-parameter \
  --name "/f3rva/dev/f3nation_api_key" \
  --value "your-f3-nation-api-key" \
  --type "SecureString" \
  --overwrite
```

#### Production Environment (`prod`):
```bash
# 1. Database Connection URL
aws ssm put-parameter \
  --name "/f3rva/prod/database_url" \
  --value "mysql+pymysql://<user>:<password>@<prod-rds-host>:3306/f3rva_bd?charset=utf8mb4" \
  --type "SecureString" \
  --overwrite

# 2. JWT Signing Key
aws ssm put-parameter \
  --name "/f3rva/prod/jwt_secret_key" \
  --value "$(openssl rand -hex 32)" \
  --type "SecureString" \
  --overwrite

# 3. Admin Username & Password
aws ssm put-parameter \
  --name "/f3rva/prod/admin_username" \
  --value "admin" \
  --type "String" \
  --overwrite

aws ssm put-parameter \
  --name "/f3rva/prod/admin_password" \
  --value "your-strong-prod-password" \
  --type "SecureString" \
  --overwrite

# 4. F3 Nation API Key
aws ssm put-parameter \
  --name "/f3rva/prod/f3nation_api_key" \
  --value "your-f3-nation-api-key" \
  --type "SecureString" \
  --overwrite
```

---

## Notes on each stack

### API (`F3RVAStackApi`)
This stack creates the unified REST API infrastructure for F3 RVA:
* **API Lambda Function** (`f3rva-{env}-api-lambda`): Python 3.13 / ARM64 execution environment running the FastAPI application via the Mangum ASGI adapter. Read access to `/f3rva/{env}/*` in SSM Parameter Store is automatically granted.
* **CloudFront Distribution**: Custom domain (`api.dev.f3rva.org` / `api.f3rva.org`) backed by the wildcard ACM certificate. Routes all traffic directly to the Lambda Function URL via Origin Access Control (OAC) with SigV4 signing.
* **Route53 DNS**: Creates an alias A-record pointing the `api` subdomain to the CloudFront distribution.

### DNS
This stack creates the Route53 hosted zones to support DNS. This currently creates the hosted zone and adds an MX record to receive emails.

### Email
This is the stack to setup SES for sending and receiving emails. There is simple routing to receive emails in SES and then route them to an SNS topic, subscribed to by a Lambda service, and then forwarded out to a preconfigured email.

### Network
This creates the VPC infrastructure for everything else in the account that needs it.

### Certificates
This stack creates the baseline wildcard certificates needed for each domain.

### Storage
This stack creates the filesystem needs for WordPress (EFS persistent storage).

### EC2
A prerequisite for creating the EC2s is to create a key pair to allow SSH access after creation.