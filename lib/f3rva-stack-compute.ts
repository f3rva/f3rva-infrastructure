import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';
import { readFileSync } from 'fs';


export class F3RVAStackCompute extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    const tag = new cdk.CfnParameter(this, "tag", {
      type: "String",
      default: "",
      description: "OPTIONAL: The tag to use for the build. Required if branch is not specified."});
    const tagValue = tag.valueAsString;
  
    // stack parameters
    const branch = new cdk.CfnParameter(this, "branch", {
      type: "String",
      default: "",
      description: "OPTIONAL: The branch to pull from for this build"});
    const branchValue = branch.valueAsString;

      // stack props
    const appName = props!.appName;
    const envName = props!.envName;

    const instanceType = props!.webInstanceType!;
    const vpc = props!.vpc!;
    const securityGroup = props!.securityGroup!;
    const amiId = props!.amiId;

    // Look up the AMI Id bitnami wordpress instance
    const ami = ec2.MachineImage.genericLinux({
      "us-east-1": amiId
    });

    // Create a Key Pair to be used with this EC2 Instance
    // const key = new ec2.CfnKeyPair(this, 'KeyPair', {
    //   keyName: 'wordpress-keypair',
    // });

    // Create a secrets policy statement
    const secretsReadPolicyStatement = new iam.PolicyStatement({
      actions: [
        "secretsmanager:GetResourcePolicy",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecretVersionIds"
      ],
      // grant all secrets for the account
      resources: [`arn:aws:secretsmanager:*:${props!.env!.account}:secret:*`]
    });

    // create a managed policy
    const webApplicationPolicy = new iam.Policy(this, "WebApplicationPolicy", {
      statements: [
        secretsReadPolicyStatement
      ]
    });

    // Create an IAM role for this instance and attach policy
    const ec2Role = new iam.Role(this, "WebApplicationInstanceRole" , {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM role for web instances'
    });
    ec2Role.attachInlinePolicy(webApplicationPolicy);

    const instance = new ec2.Instance(this, "web-instance", {
      vpc: vpc,
      instanceType: instanceType,
      machineImage: ami,
      securityGroup: securityGroup,
      keyName: "f3rva-dev-wordpress-key-pair",
      role: ec2Role
    });

    instance.addUserData(
      `BRANCH_NAME=${branchValue}`,
      `ENV_NAME=${envName}`,
      `TAG_NAME=${tagValue}`
    );
    instance.addUserData(
      readFileSync(`./scripts/bootstrap.sh`, "utf8")
    );
    instance.addUserData(      
      `./setup-core.sh ${envName}`
    );
  }
}
