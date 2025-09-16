import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

////////////////////////////////////////////////////////////////////////////////////////////////
// The purpose of this stack is to create the required S3 buckets for deployment.
//
// 1. Create a S3 bucket necessary for the website
// 2. Create the roles needed to remotely deploy to the bucket
// 3. Create a CloudFront distribution in front of the S3 bucket
// 4. Create the DNS records to point to the CloudFront distribution
////////////////////////////////////////////////////////////////////////////////////////////////
export class F3RVAStackS3 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const accountNumber = props!.env?.account;
    const baseDomainName = props!.baseDomain;
    const webDomainName = props!.webDomainName;
    const hostedZoneDomains = props!.dns.hostedZones;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack inputs
    const wildcardCertificateArn = cdk.Fn.importValue(
      `${appName}-${envName}-${baseDomainName.replace(/\./g, "-")}-wildcardCertificateArn`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Create a bucket and the associated policies to host web content
    const websiteBucketName = `${appName}-${envName}-website`;
    const websiteBucket = new s3.Bucket(this, websiteBucketName, {
      bucketName: websiteBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });
    cdk.Tags.of(websiteBucket).add('Name', websiteBucketName);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Create a bucket used to redirect alternative domain names to the main domain name
    const redirectBucketName = `${appName}-${envName}-redirect`;
    const redirectBucket = new s3.Bucket(this, redirectBucketName, {
      bucketName: redirectBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY,
      websiteRedirect: {
        hostName: baseDomainName,
        protocol: s3.RedirectProtocol.HTTPS
      }
    });
    cdk.Tags.of(redirectBucket).add('Name', redirectBucketName);

    // Create the CloudFront Origin Access Control to link the S3 bucket to CloudFront
    const cfOACName = `${appName}-${envName}-website-distribution-oac`;
    const oac = new cf.S3OriginAccessControl(this, cfOACName, {
      signing: cf.Signing.SIGV4_ALWAYS
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(websiteBucket, {
      originAccessControl: oac
    });
    
    // Create CloudFront function for redirects
    const redirectsFunctionName = `${appName}-${envName}-website-redirects-function`;
    const redirectsFunction = new cf.Function(this, redirectsFunctionName, {
      code: cf.FunctionCode.fromFile( {
        filePath: path.join(__dirname, '..', 'src', 'functions', 'cloudfront', 'redirects.js'),
      }),
      comment: 'CloudFront function that implements site redirects',
      runtime: cf.FunctionRuntime.JS_2_0,
      functionName: redirectsFunctionName
    });

    // setup CloudFront logging bucket and policy
    const cfLoggingBucketName = `${appName}-${envName}-cf-logs`;
    const cfLogFilePrefix = 'cf-logs/';
    const cfLoggingBucket = new s3.Bucket(this, cfLoggingBucketName, {
      bucketName: cfLoggingBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
    });
    cdk.Tags.of(cfLoggingBucket).add('Name', cfLoggingBucketName);

    // Create CloudFront distribution in front of the S3 bucket
    const wildcardCertificate = cm.Certificate.fromCertificateArn(this, "WildcardCertificate", wildcardCertificateArn);
    const cfDistributionName = `${appName}-${envName}-website-distribution`;
    const cfDistribution = new cf.Distribution(this, cfDistributionName, {
      defaultRootObject: 'index.html',
      httpVersion: cf.HttpVersion.HTTP2,
      enableLogging: true,
      logBucket: cfLoggingBucket,
      logFilePrefix: cfLogFilePrefix,
      certificate: wildcardCertificate,
      defaultBehavior: {
        allowedMethods: cf.AllowedMethods.ALLOW_ALL,
        cachedMethods: cf.CachedMethods.CACHE_GET_HEAD,
        compress: true,
        functionAssociations: [ {
          eventType: cf.FunctionEventType.VIEWER_REQUEST,
          function: redirectsFunction
        }],
        origin: s3Origin,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      domainNames: [
        baseDomainName,
        webDomainName
      ],
      errorResponses: [
        {
          httpStatus: 403,
          responsePagePath: '/index.html',
          responseHttpStatus: 200,
          ttl: cdk.Duration.minutes(5)
        },
        {
          httpStatus: 404,
          responsePagePath: '/index.html',
          responseHttpStatus: 200,
          ttl: cdk.Duration.minutes(5)
        },
      ],
      minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: cf.PriceClass.PRICE_CLASS_100, // US, Canada, Europe, Isreal
    });
    cdk.Tags.of(cfDistribution).add("Name", `${cfDistributionName}`);

    // Add a bucket policy to only allow the CloudFront distribution to access the bucket
    websiteBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowCloudFrontOACReadOnly',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [websiteBucket.arnForObjects('*')],
      conditions: {
        StringEquals: { 'aws:SourceArn': cfDistribution.distributionArn }
      },
    }));

    // Add a bucket policy to allow CloudFront to write logs to the logging bucket
    cfLoggingBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowCloudFrontLogging',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:PutObject'],
      resources: [cfLoggingBucket.arnForObjects(`${cfLogFilePrefix}*`)],
    }));

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // link the cloudfront distribution to the route 53 hosted zone
    hostedZoneDomains.forEach(domain => {
      const hostedZoneId = cdk.Fn.importValue(`${appName}-${envName}-${domain.replace(/\./g, ":")}-hostedZone`);
      const hostedZoneName = `${appName}-${envName}-${domain}-hostedZone`;
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, hostedZoneName, {
        hostedZoneId: hostedZoneId,
        zoneName: domain,
      });

      // if the domain is the same as the basedomain, link it to cloudfront
      // if not, link it to s3 redirect bucket
      var aRecordTarget : route53.IAliasRecordTarget = new targets.BucketWebsiteTarget(redirectBucket);
      if (domain === baseDomainName) {
        aRecordTarget = new targets.CloudFrontTarget(cfDistribution);
      }
      // create the A record
      const aRecordName = `${appName}-${envName}-${domain}-aRecord`;
      const aRecord = new route53.ARecord(this, aRecordName, {
        zone: hostedZone,
        //recordName: hostedZone.zoneName,
        target: route53.RecordTarget.fromAlias(aRecordTarget)
      });
      aRecord.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

      // create a CNAME record for all base domains for the www subdomain
      const cnameRecordNameBase = `${appName}-${envName}-${domain}-${webDomainName}-cnameRecord`;
      const cnameRecordBase = new route53.CnameRecord(this, cnameRecordNameBase, {
        zone: hostedZone,
        recordName: "www",
        domainName: domain,
      });
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // import the GH Actions role ARN and create a role reference
    const ghActionsRoleArn = cdk.Fn.importValue(`${appName}-${envName}-ghActionsRoleArn`);
    const ghActionsRole = iam.Role.fromRoleArn(this, 'ghActionsRole', ghActionsRoleArn, { mutable: true });

    // allow syncing to the bucket
    const s3FullAccessPolicy = new iam.PolicyStatement({
      sid: 'AllowGHActionSyncing',
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:GetObjectVersion'],
      resources: [websiteBucket.bucketArn, websiteBucket.bucketArn + '/*']
    });
    ghActionsRole.addToPrincipalPolicy(s3FullAccessPolicy);

    // allow cloudfront distribution invalidation
    const cfResourceArn = `arn:aws:cloudfront::${accountNumber}:distribution/${cfDistribution.distributionId}`;
    const cfInvalidationPolicy = new iam.PolicyStatement({
      sid: 'AllowGHActionInvalidation',
      effect: iam.Effect.ALLOW,
      actions: ['cloudfront:CreateInvalidation'],
      resources: [cfResourceArn]
    });
    ghActionsRole.addToPrincipalPolicy(cfInvalidationPolicy);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);

    ///////////////////////////////////////////////////////////////////////////
    // output
    new cdk.CfnOutput(this, 'websiteBucketName', {
      value: websiteBucket.bucketName,
      exportName: `${appName}-${envName}-websiteBucketName`
    });

    new cdk.CfnOutput(this, 'websiteBucketArn', {
      value: websiteBucket.bucketArn,
      exportName: `${appName}-${envName}-websiteBucketArn`
    });

    new cdk.CfnOutput(this, 'cloudFrontDomainName', {
      value: cfDistribution.distributionDomainName,
      exportName: `${appName}-${envName}-cloudFrontDomainName`
    });

    new cdk.CfnOutput(this, 'cloudFrontDistributionId', {
      value: cfDistribution.distributionId,
      exportName: `${appName}-${envName}-cloudFrontDistributionId`
    });

    new cdk.CfnOutput(this, 'redirectsFunctionName', {
      value: redirectsFunction.functionName,
      exportName: `${appName}-${envName}-redirectsFunctionName`
    });
  }
}
