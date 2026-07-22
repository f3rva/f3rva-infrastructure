import * as cdk from 'aws-cdk-lib';
import * as cm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';
import { BasePythonLambda } from './constructs/base-python-lambda';

export class F3RVAStackScheduleApi extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const f3rvaRegionId = props!.f3rvaRegionId;
    const apiDomainName = props!.apiDomainName;
    const baseDomain = props!.baseDomain;
    const ssmParamName = `/f3rva/${envName}/f3nation_api_key`;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Lambda function (AWS_IAM authentication mode to comply with public-access boundary rules)
    const scheduleLambdaName = `${appName}-${envName}-schedule-api-lambda`;
    const scheduleLambda = new BasePythonLambda(this, scheduleLambdaName, {
      entry: 'src/lambda/schedule_api',
      ssmParamName,
      authType: cdk.aws_lambda.FunctionUrlAuthType.AWS_IAM,
      environment: {
        F3_REGION_ID: f3rvaRegionId,
        CLIENT_ID: 'f3rva-website',
        SSM_PARAM_NAME: ssmParamName,
      },
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Import Wildcard Certificate created by F3RVAStackCertificates
    const wildcardCertArn = cdk.Fn.importValue(`${appName}-${envName}-wildcardCertificateArn`);
    const wildcardCertName = `${appName}-${envName}-wildcardCert`;
    const certificate = cm.Certificate.fromCertificateArn(this, wildcardCertName, wildcardCertArn);

    // Look up the base hosted zone (dev.f3rva.org or f3rva.org)
    const hostedZoneName = `${appName}-${envName}-baseHostedZone`;
    const hostedZone = route53.HostedZone.fromLookup(this, hostedZoneName, {
      domainName: baseDomain,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Create CloudFront FunctionUrlOriginAccessControl (OAC) to sign requests securely via SigV4
    const oacName = `${appName}-${envName}-schedule-api-oac`;
    const oac = new cloudfront.FunctionUrlOriginAccessControl(this, oacName, {
      originAccessControlName: oacName,
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // CloudFront Distribution mapping api.dev.f3rva.org / api.f3rva.org with edge caching
    const cfDistributionName = `${appName}-${envName}-schedule-api-distribution`;
    const cfDistribution = new cloudfront.Distribution(this, cfDistributionName, {
      domainNames: [apiDomainName],
      certificate,
      defaultBehavior: {
        origin: origins.FunctionUrlOrigin.withOriginAccessControl(scheduleLambda.fnUrl, {
          originAccessControl: oac,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });
    cdk.Tags.of(cfDistribution).add('Name', cfDistributionName);

    // Grant CloudFront OAC permission to invoke the Lambda Function URL via resource policy
    scheduleLambda.fn.addPermission('AllowCloudFrontOAC', {
      principal: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
      action: 'lambda:InvokeFunctionUrl',
      sourceArn: `arn:aws:cloudfront::${this.account}:distribution/${cfDistribution.distributionId}`,
    });

    scheduleLambda.fn.addPermission('AllowCloudFrontOACInvoke', {
      principal: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:cloudfront::${this.account}:distribution/${cfDistribution.distributionId}`,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Route53 Alias Record pointing api.dev.f3rva.org -> CloudFront Distribution
    const aRecordName = `${appName}-${envName}-schedule-api-aRecord`;
    new route53.ARecord(this, aRecordName, {
      zone: hostedZone,
      recordName: 'api',
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(cfDistribution)),
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add('APPLICATION', appName);
    cdk.Tags.of(this).add('ENVIRONMENT', envName);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // outputs
    new cdk.CfnOutput(this, 'ScheduleApiUrl', {
      value: scheduleLambda.fnUrl.url,
      exportName: `${appName}-${envName}-ScheduleApiUrl`,
    });

    new cdk.CfnOutput(this, 'ScheduleApiCustomDomainUrl', {
      value: `https://${apiDomainName}/schedule`,
      exportName: `${appName}-${envName}-ScheduleApiCustomDomainUrl`,
    });
  }
}
