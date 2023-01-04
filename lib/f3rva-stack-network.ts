import * as cdk from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

//
// Stack to create the primary VPC and all necessary subnets
//
export class F3RVAStackNetwork extends cdk.Stack {
  // properties that can be shared to other stacks
  public readonly vpc: ec2.Vpc;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    // stack paramerters
    const appName = props!.appName!;
    const envName = props!.envName!;

    // create new vpc
    const vpcName = `${appName}-${envName}`;
    const vpc = new ec2.Vpc(this, vpcName, {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 1,
      natGateways: 0,
      
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC
        }
      ]
    });
    // create a tag to name the VPC
    cdk.Tags.of(vpc).add('Name', `${vpcName}`)

    // define function that tags subnets
    const tagAllSubnets = (
      subnets: ec2.ISubnet[],
      tagName: string,
      tagValue: string,
      includeAZ: boolean
    ) => {
      for (const subnet of subnets) {
        const tagConcat = (includeAZ) ? `${tagValue}-${subnet.availabilityZone}` : `${tagValue}`;
        cdk.Tags.of(subnet).add(tagName, tagConcat);
      }
    };

    // tag subnets
    tagAllSubnets(vpc.publicSubnets, 'Name', `${vpcName}/public`, true);
    tagAllSubnets(vpc.publicSubnets, 'Environment', `${envName}`, false);

    // assign VPC property so it is accessible in other stacks
    this.vpc = vpc;

    // create security group
    const securityGroupName = `${appName}-${envName}/security-group`;
    this.securityGroup = new ec2.SecurityGroup(this, securityGroupName, {
      vpc,
      description: "Allow SSH (TCP port 22) and HTTP (TCP port 80/443) in",
      allowAllOutbound: true,
    });

    // Allow SSH access on port tcp/22
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH Access"
    );

    // Allow HTTP access on port tcp/80
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP Access"
    );

    // Allow HTTP access on port tcp/80
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS Access"
    );

    // create a tag to name the Security Group
    cdk.Tags.of(this.securityGroup).add('Name', `${securityGroupName}`)
  }
}
