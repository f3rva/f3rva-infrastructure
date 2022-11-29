import * as cdk from 'aws-cdk-lib';
import { Tags } from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

//
// Stack to create the primary VPC and all necessary subnets
//
export class F3RVAStackNetwork extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    // stack paramerters
    const appName = props!.appName!;
    const envName = props!.envName!;

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
        },
        {
          cidrMask: 24,
          name: "application",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        {
          cidrMask: 24,
          name: "restricted",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
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
    tagAllSubnets(vpc.isolatedSubnets, 'Name', `${vpcName}/application`, true);
    tagAllSubnets(vpc.privateSubnets, 'Name', `${vpcName}/restricted`, true);

    tagAllSubnets(vpc.publicSubnets, 'Environment', `${envName}`, false);
    tagAllSubnets(vpc.isolatedSubnets, 'Environment', `${envName}`, false);
    tagAllSubnets(vpc.privateSubnets, 'Environment', `${envName}`, false);
  }
}
