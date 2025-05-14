#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { F3RVAStackProps, F3RVAStackDNSProps } from '../lib/f3rva-stack-properties';
import { F3RVAStackDNS } from '../lib/f3rva-stack-dns';
import { F3RVAStackEmail } from '../lib/f3rva-stack-email';
import { F3RVAStackNetwork } from '../lib/f3rva-stack-network';
import { F3RVAStackDatabase } from '../lib/f3rva-stack-database';
import { F3RVAStackStorage } from '../lib/f3rva-stack-storage';
import { F3RVAStackCompute } from '../lib/f3rva-stack-compute';
import { F3RVAStackCertificates } from '../lib/f3rva-stack-certificates';
import { F3RVAStackDistribution } from '../lib/f3rva-stack-distribution';
import { F3RVAStackLambda } from '../lib/f3rva-stack-lambda';

// accounts
//const awsAccountDevelopment = { account: '908188673576', region: 'us-east-1' };
const awsAccountDevelopment = { account: '590183876163', region: 'us-east-1' };
const awsAccountProduction = { account: '992382422376', region: 'us-east-1' };

// stacks
let stackProperties: { [name: string]: F3RVAStackProps } = {};
const devStackKey = "f3rva-dev";
const prodStackKey = "f3rva-prod";

// common parameters across environments
const appName = "f3rva";
const bdDatabaseName = "f3rva_bd";
const webDatabaseName = "f3rva_web";
const inboundSMTP = "inbound-smtp.us-east-1.amazonaws.com";

const devStackDNSProperties: F3RVAStackDNSProps = {
  env: awsAccountDevelopment,
  appName: appName,
  envName: "dev",
  hostedZones: ["dev.f3rva.org"],
  inboundSMTP: inboundSMTP
}

const prodStackDNSProperties: F3RVAStackDNSProps = {
  env: awsAccountProduction,
  appName: appName,
  envName: "prod",
  hostedZones: ["f3rva.com", "f3rva.net", "f3rva.org", ],
  inboundSMTP: inboundSMTP,
  terminationProtection: true // prevent this stack from being terminated so we don't lose public DNS
}

const devStackProperties: F3RVAStackProps = { 
  env: awsAccountDevelopment,
  appName: appName,
  envName: "dev",
  databaseInstanceName: "f3rva_dev",
  databaseInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  bdDatabaseName: bdDatabaseName,
  webDatabaseName: webDatabaseName,
  webInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.MICRO),
  amiId: "ami-0df435f331839b2d6", // Amazon Linux 2023 AMI
  keyPairName: "f3rva-dev-wordpress-key-pair",
  adminEmailSource: "admin@dev.f3rva.org",
  adminEmailDestination: "f3rva.corporate.dev@gmail.com",
  baseDomain: "dev.f3rva.org",
  bdDomainName: "bigdata.dev.f3rva.org",
  webDomainName: "web.dev.f3rva.org"
}

const prodStackProperties: F3RVAStackProps = stackProperties[prodStackKey] = { 
  env: awsAccountProduction,
  appName: appName,
  envName: "prod",
  databaseInstanceName: "f3rva_prod",
  databaseInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  bdDatabaseName: bdDatabaseName,
  webDatabaseName: webDatabaseName,
  webInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.MICRO),
  amiId: "ami-0df435f331839b2d6", // Amazon Linux 2023 AMI
  keyPairName: "f3rva-prod-wordpress-key-pair",
  adminEmailSource: "admin@f3rva.org",
  adminEmailDestination: "f3rva.corporate.prod@gmail.com",
  baseDomain: "f3rva.org",
  bdDomainName: "bigdata.f3rva.org",
  webDomainName: "f3rva.org"
}

const app = new cdk.App();

// dev stack
const devDnsStack = new F3RVAStackDNS(app, "F3RVA-dns-dev", devStackDNSProperties);
const devEmailStack = new F3RVAStackEmail(app, "F3RVA-email-dev", devStackProperties);
const devNetworkStack = new F3RVAStackNetwork(app, "F3RVA-network-dev", devStackProperties);
devStackProperties.vpc = devNetworkStack.vpc;
const devCertificatesStack = new F3RVAStackCertificates(app, "F3RVA-certificates-dev", devStackProperties);
const devStorageStack = new F3RVAStackStorage(app, "F3RVA-storage-dev", devStackProperties);
const devDataStack = new F3RVAStackDatabase(app, "F3RVA-database-dev", devStackProperties);
const devEc2Stack = new F3RVAStackCompute(app, "F3RVA-wordpress-dev", devStackProperties);
const devCfStack = new F3RVAStackDistribution(app, "F3RVA-distribution-dev", devStackProperties);
const devLambdaStack = new F3RVAStackLambda(app, "F3RVA-lambda-dev", devStackProperties);

// prod stack
const prodDnsStack = new F3RVAStackDNS(app, "F3RVA-dns-prod", prodStackDNSProperties);
const prodEmailStack = new F3RVAStackEmail(app, "F3RVA-email-prod", prodStackProperties);
const prodNetworkStack = new F3RVAStackNetwork(app, "F3RVA-network-prod", prodStackProperties);
prodStackProperties.vpc = prodNetworkStack.vpc;
const prodCertificatesStack = new F3RVAStackCertificates(app, "F3RVA-certificates-prod", prodStackProperties);
const prodStorageStack = new F3RVAStackStorage(app, "F3RVA-storage-prod", prodStackProperties);
const prodDataStack = new F3RVAStackDatabase(app, "F3RVA-database-prod", prodStackProperties);
const prodEc2Stack = new F3RVAStackCompute(app, "F3RVA-wordpress-prod", prodStackProperties);
const prodCfStack = new F3RVAStackDistribution(app, "F3RVA-distribution-prod", prodStackProperties);
const prodLambdaStack = new F3RVAStackLambda(app, "F3RVA-lambda-prod", prodStackProperties);
