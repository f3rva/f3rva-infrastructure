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
    const baseDomain = props!.baseDomain
    const hostedZoneDomains = props!.dns.hostedZones;

    // create array of subject alternative names based on the hosted zones
    const sanDomainNames: string[] = [];
    var primaryHostedZone: route53.IHostedZone = {} as route53.IHostedZone;

    // validationDomains facilitates: acm.CertificateValidation.fromDnsMultiZone
    const validationDomains = {} as { [key: string]: route53.IHostedZone };

    // look up each hosted zone and prepare the SAN list and validation domains
    hostedZoneDomains.forEach(domain => {
      const hostedZoneName = `${appName}-${envName}-${domain}-hostedZone`;
      const hostedZone = route53.HostedZone.fromLookup(this, hostedZoneName, {
        domainName: domain,
      });

      // add the naked and wildcard domain to the validation domains
      validationDomains[domain] = hostedZone;
      validationDomains["*." + domain] = hostedZone;

      // if it's the primary domain, save the hosted zone
      // otherwise add the wildcard to the SAN list, we don't need to add the 
      // wildcard for the primary domain because it's specified as the main domain name
      // on the certificate
      if (domain === baseDomain) {
        primaryHostedZone = hostedZone;
      } else {
        sanDomainNames.push("*." + domain);
      }
      // always add the naked domain
      sanDomainNames.push(domain);
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // wildcard certificate
    const wildcardDomainName = "*." + primaryHostedZone.zoneName;
    const wildcardCertName = `${appName}-${envName}-wildcardCert`;
    const wildcardCertificate = new cm.Certificate(this, wildcardCertName, {
      domainName: wildcardDomainName,
      subjectAlternativeNames: sanDomainNames,
      certificateName: `${appName}-${envName}-wildcardCert`,
      validation: cm.CertificateValidation.fromDnsMultiZone(validationDomains)
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // outputs
    new cdk.CfnOutput(this, `WildcardCertificateArn`, {
      value: wildcardCertificate.certificateArn,
      exportName: `${appName}-${envName}-wildcardCertificateArn`
    });
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}