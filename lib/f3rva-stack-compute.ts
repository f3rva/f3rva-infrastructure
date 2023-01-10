import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';
import { readFileSync } from 'fs';


export class F3RVAStackCompute extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

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

    const instance = new ec2.Instance(this, "web-instance", {
      vpc: vpc,
      instanceType: instanceType,
      machineImage: ami,
      securityGroup: securityGroup,
      keyName: "f3rva-dev-wordpress-key-pair"
    });

    instance.addUserData(
      `BRANCH_NAME=${branchValue}`,
      `ENV_NAME=${envName}`
    );
    instance.addUserData(
      readFileSync(`./scripts/bootstrap.sh`, "utf8")
    );
    instance.addUserData(      
      `./setup-core.sh ${envName}`
    );
  }
}
