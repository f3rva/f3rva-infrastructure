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
  public readonly webEIP: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create new vpc
    const vpcName = `${appName}-${envName}`;
    const vpc = new ec2.Vpc(this, vpcName, {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
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

    // assign VPC property so it is accessible in other stacks
    this.vpc = vpc;
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create EIPs
    //const webEIPName = `${appName}-${envName}-web-eip`;
    //this.webEIP = new ec2.CfnEIP(this, webEIPName, {
    //  tags: [ new cdk.Tag("Name", webEIPName)]
    //});

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}
