import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as fs from 'fs';
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

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
    const region = props!.env!.region!;

    const instanceType = props!.webInstanceType!;
    const vpc = props!.vpc!;
    const securityGroup = props!.securityGroup!;
    const amiId = props!.amiId;
    const keyPair = props!.keyPair;

    // Look up the AMI Id
    const amiMap: Record<string, string> = {
      "us-east-1": amiId
    }
    const ami = ec2.MachineImage.genericLinux(amiMap);

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
    const webApplicationPolicyName = "webApplicationPolicy";
    const webApplicationPolicy = new iam.ManagedPolicy(this, webApplicationPolicyName, {
      statements: [
        secretsReadPolicyStatement
      ]
    });
    cdk.Tags.of(webApplicationPolicy).add("Name", `${appName}-${envName}-${webApplicationPolicyName}`);

    // Create an IAM role for this instance and attach policy
    const ec2RoleName = "webApplicationInstanceRole";
    const ec2Role = new iam.Role(this, ec2RoleName , {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM role for web instances'
    });
    ec2Role.addManagedPolicy(webApplicationPolicy);
    cdk.Tags.of(ec2Role).add("Name", `${appName}-${envName}-${ec2RoleName}`);

    const ec2InstanceName = "webApplicationInstance";
    const ec2Instance = new ec2.Instance(this, ec2InstanceName, {
      vpc: vpc,
      instanceType: instanceType,
      machineImage: ami,
      securityGroup: securityGroup,
      keyName: keyPair,
      role: ec2Role
    });
    cdk.Tags.of(ec2Instance).add("Name", `${appName}-${envName}-${ec2InstanceName}`);

    ec2Instance.addUserData(
      `BRANCH_NAME=${branchValue}`,
      `ENV_NAME=${envName}`,
      `AWS_REGION=${region}`,
      `TAG_NAME=${tagValue}`
    );
    ec2Instance.addUserData(
      fs.readFileSync(`./scripts/bootstrap.sh`, "utf8")
    );
    ec2Instance.addUserData(      
      `./setup-core.sh ${envName}`
    );
  }
}
