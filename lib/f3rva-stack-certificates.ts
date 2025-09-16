import * as cdk from 'aws-cdk-lib';
import * as cm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

export class F3RVAStackCertificates extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const hostedZoneDomains = props!.dns.hostedZones;

    hostedZoneDomains.forEach(domain => {
      ////////////////////////////////////////////////////////////////////////////////////////////////    
      // lookup the hosted zone
      const hostedZoneName = `${appName}-${envName}-${domain}-hostedZone`;
      const hostedZone = route53.HostedZone.fromLookup(this, hostedZoneName, {
        domainName: domain, // or the domain name of your hosted zone
      });

      // create array of subject alternative names based on the hosted zones
      // each domain gets both the root domain and the www subdomain
      const sanDomainNames: string[] = [];
      sanDomainNames.push(`www.${domain}`);
      sanDomainNames.push(domain);

      ////////////////////////////////////////////////////////////////////////////////////////////////
      // wildcard certificate
      const wildcardDomainName = "*." + domain;
      const wildcardCertName = `${appName}-${envName}-${domain}-wildcardCert`;
      const wildcardCertificate = new cm.Certificate(this, wildcardCertName, {
        domainName: wildcardDomainName,
        subjectAlternativeNames: sanDomainNames,
        certificateName: `${appName}-${envName}-${domain}-wildcardCert`,
        validation: cm.CertificateValidation.fromDns(hostedZone)
      });

      ////////////////////////////////////////////////////////////////////////////////////////////////
      // outputs
      new cdk.CfnOutput(this, `${domain}-WildcardCertificateArn`, {
        value: wildcardCertificate.certificateArn,
        exportName: `${appName}-${envName}-${domain.replace(/\./g, "-")}-wildcardCertificateArn`
      });
    });
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}