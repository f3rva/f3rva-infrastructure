#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { F3RVAStackProps, F3RVAStackDNSProps } from '../lib/f3rva-stack-properties';
import { F3RVAStackDNS } from '../lib/f3rva-stack-dns';
import { F3RVAStackEmail } from '../lib/f3rva-stack-email';
import { F3RVAStackCertificates } from '../lib/f3rva-stack-certificates';
import { F3RVAStackS3 } from '../lib/f3rva-stack-s3';
import { F3RVAStackSecurity } from '../lib/f3rva-stack-security';

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
  dns: devStackDNSProperties,
  appName: appName,
  envName: "dev",
  databaseInstanceName: "f3rva_dev",
  databaseInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
  bdDatabaseName: bdDatabaseName,
  webDatabaseName: webDatabaseName,
  webInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
  amiId: "ami-05a3e0187917e3e24", // Amazon Linux 2023 AMI ARM64
  keyPairName: "f3rva-dev-wordpress-key-pair",
  adminEmailSource: "admin@dev.f3rva.org",
  adminEmailDestination: "f3rva.corporate.dev@gmail.com",
  baseDomain: "dev.f3rva.org",
  bdDomainName: "bigdata.dev.f3rva.org",
  webDomainName: "www.dev.f3rva.org"
}

const prodStackProperties: F3RVAStackProps = stackProperties[prodStackKey] = { 
  env: awsAccountProduction,
  dns: prodStackDNSProperties,
  appName: appName,
  envName: "prod",
  databaseInstanceName: "f3rva_prod",
  databaseInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
  bdDatabaseName: bdDatabaseName,
  webDatabaseName: webDatabaseName,
  webInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
  amiId: "ami-05a3e0187917e3e24", // Amazon Linux 2023 AMI ARM64
  keyPairName: "f3rva-prod-wordpress-key-pair",
  adminEmailSource: "admin@f3rva.org",
  adminEmailDestination: "f3rva.corporate.prod@gmail.com",
  baseDomain: "f3rva.org",
  bdDomainName: "bigdata.f3rva.org",
  webDomainName: "www.f3rva.org"
}

const app = new cdk.App();

// dev stack
const devDnsStack = new F3RVAStackDNS(app, "F3RVA-dns-dev", devStackDNSProperties);
const devEmailStack = new F3RVAStackEmail(app, "F3RVA-email-dev", devStackProperties);
const devCertificatesStack = new F3RVAStackCertificates(app, "F3RVA-certificates-dev", devStackProperties);
const devSecurityStack = new F3RVAStackSecurity(app, "F3RVA-security-dev", devStackProperties);
const devS3Stack = new F3RVAStackS3(app, "F3RVA-s3-dev", devStackProperties);

// prod stack
const prodDnsStack = new F3RVAStackDNS(app, "F3RVA-dns-prod", prodStackDNSProperties);
const prodEmailStack = new F3RVAStackEmail(app, "F3RVA-email-prod", prodStackProperties);
const prodCertificatesStack = new F3RVAStackCertificates(app, "F3RVA-certificates-prod", prodStackProperties);
const prodSecurityStack = new F3RVAStackSecurity(app, "F3RVA-security-prod", prodStackProperties);
const prodS3Stack = new F3RVAStackS3(app, "F3RVA-s3-prod", prodStackProperties);
