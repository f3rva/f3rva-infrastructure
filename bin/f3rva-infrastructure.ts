#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { F3RVAStackProps } from '../lib/f3rva-stack-properties';
import { F3RVAStackNetwork } from '../lib/f3rva-stack-network';
import { F3RVAStackStorage } from '../lib/f3rva-stack-storage';
import { F3RVAStackCompute } from '../lib/f3rva-stack-compute';
import { F3RVAStackCertificates } from '../lib/f3rva-stack-certificates';

let stackProperties: { [name: string]: F3RVAStackProps } = {};
const devStackKey = "f3rva-dev";
const prodStackKey = "f3rva-prod";

const awsAccountDevelopment = { account: '908188673576', region: 'us-east-1' };
const awsAccountProduction = { account: 'TBD', region: 'us-east-1' };

stackProperties[devStackKey] = { 
  env: awsAccountDevelopment,
  appName: "f3rva",
  envName: "dev",
  webInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.NANO),
  amiId: "ami-0b5eea76982371e91", // aws linux 2
  keyPair: "f3rva-dev-wordpress-key-pair",
  bdDomainName: "devbd.f3rva.org",
  webDomainName: "dev.f3rva.org"
}

const app = new cdk.App();

// create the network stack and save the VPC that was created
const networkStack = new F3RVAStackNetwork(app, "F3RVA-network-dev", stackProperties[devStackKey]);
stackProperties[devStackKey].vpc = networkStack.vpc;
const certificatesStack = new F3RVAStackCertificates(app, "F3RVA-certificates-dev", stackProperties[devStackKey]);
const storageStack = new F3RVAStackStorage(app, "F3RVA-storage-dev", stackProperties[devStackKey]);
const ec2Stack = new F3RVAStackCompute(app, "F3RVA-wordpress-dev", stackProperties[devStackKey]);

