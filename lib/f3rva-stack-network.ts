import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

//
// Stack to create the primary VPC and all necessary subnets
//
export class F3RVAStackNetwork extends cdk.Stack {
  // properties that can be shared to other stacks
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const hostedZoneDomain = props!.hostedZone;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create new vpc
    const vpcName = `${appName}-${envName}`;
    this.vpc = new ec2.Vpc(this, vpcName, {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
      natGateways: 0,
      
      subnetConfiguration: [
        {
          cidrMask: 25,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC
        },
        {
          cidrMask: 25,
          name: "restricted",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      ]
    });
    // create a tag to name the VPC
    cdk.Tags.of(this.vpc).add('Name', `${vpcName}`)

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
    tagAllSubnets(this.vpc.publicSubnets, 'Name', `${vpcName}/public`, true);
    tagAllSubnets(this.vpc.isolatedSubnets, 'Name', `${vpcName}/restricted`, true);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create route 53 hosted zone
    const hostedZoneName = `${appName}-${envName}-hostedZone`;
    const hostedZone = new route53.HostedZone(this, hostedZoneName, {
      zoneName: hostedZoneDomain,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);

    ///////////////////////////////////////////////////////////////////////////
    // output
    new cdk.CfnOutput(this, "vpcId", {
      value: this.vpc.vpcId,
      exportName: `${appName}-${envName}-vpcId`
    });

    new cdk.CfnOutput(this, "hostedZoneId", {
      value: hostedZone.hostedZoneId,
      exportName: `${appName}-${envName}-hostedZoneId`
    });
  }
}
