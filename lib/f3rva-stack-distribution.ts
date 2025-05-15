import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cm from 'aws-cdk-lib/aws-certificatemanager';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
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
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}
