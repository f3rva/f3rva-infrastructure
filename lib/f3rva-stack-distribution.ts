import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cm from 'aws-cdk-lib/aws-certificatemanager';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

export class F3RVAStackDistribution extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const bdDomainName = props!.bdDomainName;
    const webDomainName = props!.webDomainName;
    const hostedZoneDomains = props!.dns.hostedZones;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack inputs
    const wildcardCertificateArn = cdk.Fn.importValue(`${appName}-${envName}-wildcardCertificateArn`);
    const ec2InstancePublicDNS = cdk.Fn.importValue(`${appName}-${envName}-ec2InstancePublicDNS`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create the cloudfront distribution
    const wildcardCertificate = cm.Certificate.fromCertificateArn(this, "WildcardCertificate", wildcardCertificateArn);
    const cfDistributionName = "cfDistribution";
    const distribution = new cf.Distribution(this, cfDistributionName, {
      defaultRootObject: "/",
      httpVersion: cf.HttpVersion.HTTP2,
      certificate: wildcardCertificate,
      defaultBehavior: {
        allowedMethods: cf.AllowedMethods.ALLOW_ALL,
        cachedMethods: cf.CachedMethods.CACHE_GET_HEAD,
        compress: true,
        origin: new origins.HttpOrigin(ec2InstancePublicDNS, {
          originId: ec2InstancePublicDNS,
          originSslProtocols: [
            cf.OriginSslPolicy.TLS_V1_2
          ],
          protocolPolicy: cf.OriginProtocolPolicy.HTTP_ONLY
        }),
        originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      domainNames: [
        webDomainName,
        bdDomainName
      ],
      minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: cf.PriceClass.PRICE_CLASS_100, // US, Canada, Europe, Isreal,
    });
    cdk.Tags.of(distribution).add("Name", `${appName}-${envName}-${cfDistributionName}`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // link the cloudfront distribution to the route 53 hosted zone
    hostedZoneDomains.forEach(domain => {
      const hostedZoneId = cdk.Fn.importValue(`${appName}-${envName}-${domain.replace(/\./g, ":")}-hostedZone`);
      const hostedZoneName = `${appName}-${envName}-${domain}-hostedZone`;
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, hostedZoneName, {
        hostedZoneId: hostedZoneId,
        zoneName: domain,
      });

      // create the A record for the cloudfront distribution for the web domain
      const aRecordNameWeb = `${appName}-${envName}-${domain}-${webDomainName}-aRecord`;
      const aRecordWeb = new route53.ARecord(this, aRecordNameWeb, {
        zone: hostedZone,
        recordName: webDomainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
        ttl: cdk.Duration.minutes(5),
      });

      cdk.Tags.of(aRecordWeb).add("Name", `${appName}-${envName}-${aRecordNameWeb}`);

      // create the A record for the cloudfront distribution for the bigdata domain
      const aRecordNameBD = `${appName}-${envName}-${domain}-${bdDomainName}-aRecord`;
      const aRecordBD = new route53.ARecord(this, aRecordNameBD, {
        zone: hostedZone,
        recordName: bdDomainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
        ttl: cdk.Duration.minutes(5),
      });

      cdk.Tags.of(aRecordBD).add("Name", `${appName}-${envName}-${aRecordNameBD}`);
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}
