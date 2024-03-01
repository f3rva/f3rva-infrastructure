import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { F3RVAStackDNSProps } from './f3rva-stack-properties';

//
// Stack to create the primary VPC and all necessary subnets
//
export class F3RVAStackDNS extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: F3RVAStackDNSProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const hostedZoneDomains = props!.hostedZones;
    const inboundSMTPDomain = props!.inboundSMTP;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create route 53 hosted zone for each domain
    hostedZoneDomains.forEach(domain => {
      const hostedZoneName = `${appName}-${envName}-${domain}-hostedZone`;
      const hostedZone = new route53.HostedZone(this, hostedZoneName, {
        zoneName: domain,
      });

      // create MX record for each domain
      const mxRecordName = `${appName}-${envName}-${domain}-mxRecord`;
      const mxRecord = new route53.MxRecord(this, mxRecordName, {
        zone: hostedZone,
        values: [
          {
            hostName: inboundSMTPDomain,
            priority: 10
          }
        ]
      });

      ///////////////////////////////////////////////////////////////////////////////////////////////
      // output
      // export names can only include alphanumeric, colons, or hyphens.  replace dots in domain name
      const exportName = `${appName}-${envName}-${domain.replace(/\./g, ":")}-hostedZone`;
      new cdk.CfnOutput(this, `${domain}-hostedZoneId`, {
        value: hostedZone.hostedZoneId,
        exportName: exportName
      });

    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);

  }
}
