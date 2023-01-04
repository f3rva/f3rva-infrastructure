import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';


export class F3RVAStackCompute extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    // stack paramerters
    const appName = props!.appName;
    const envName = props!.envName;
    const instanceType = props!.webInstanceType!;
    const vpc = props!.vpc!;
    const securityGroup = props!.securityGroup!;
    const amiId = props!.amiId;

    // Look up the AMI Id bitnami wordpress instance
    const ami = ec2.MachineImage.genericLinux({
      'us-east-1': amiId
    });

    // Create a Key Pair to be used with this EC2 Instance
    // const key = new ec2.CfnKeyPair(this, 'KeyPair', {
    //   keyName: 'wordpress-keypair',
    // });

    const instance = new ec2.Instance(this, "bitnami-instance", {
      vpc: vpc,
      instanceType: instanceType,
      machineImage: ami,
      securityGroup: securityGroup,
      keyName: 'f3rva-dev-wordpress-key-pair'
    })
  }
}
