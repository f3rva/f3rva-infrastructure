#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { F3RVAStackProps } from '../lib/f3rva-stack-properties';
import { F3RVAStackNetwork } from '../lib/f3rva-stack-network';
import { F3RVAStackStorage } from '../lib/f3rva-stack-storage';
import { F3RVAStackCompute } from '../lib/f3rva-stack-compute';

let stackProperties: { [name: string]: F3RVAStackProps } = {};

const awsAccountDevelopment = { account: '908188673576', region: 'us-east-1' };
const awsAccountProduction = { account: 'TBD', region: 'us-east-1' };

stackProperties["f3rva-dev"] = { 
  env: awsAccountDevelopment,
  appName: 'f3rva',
  envName: 'dev',
  // t3a micro, could use t4g micro if it was available
  webInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.MICRO),
  amiId: 'ami-09a0021c44c807f3f'
}

const app = new cdk.App();

// create the network stack and save the VPC that was created
const networkStack = new F3RVAStackNetwork(app, 'F3RVA-network-dev', stackProperties["f3rva-dev"]);
stackProperties["f3rva-dev"].vpc = networkStack.vpc;
stackProperties["f3rva-dev"].securityGroup = networkStack.securityGroup;

const ec2Stack = new F3RVAStackCompute(app, 'F3RVA-wordpress-dev', stackProperties["f3rva-dev"]);
