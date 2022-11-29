#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { F3RVAStackProps } from '../lib/f3rva-stack-properties';
import { F3RVAStackNetwork } from '../lib/f3rva-stack-network';
import { F3RVAStackStorage } from '../lib/f3rva-stack-storage';

let stackProperties: { [name: string]: F3RVAStackProps } = {};

const awsAccountDevelopment = { account: '908188673576', region: 'us-east-1' };
const awsAccountProduction = { account: 'TBD', region: 'us-east-1' };

stackProperties["f3rva-dev"] = { 
  env: awsAccountDevelopment,
  appName: 'f3rva',
  envName: 'dev'
}

const app = new cdk.App();

new F3RVAStackNetwork(app, 'F3RVA-network-dev', stackProperties["f3rva-dev"]);
