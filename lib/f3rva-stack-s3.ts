import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

////////////////////////////////////////////////////////////////////////////////////////////////
// The purpose of this stack is to create the required S3 buckets for deployment.
//
// 1. Create a S3 bucket necessary for the website
// 2. Create the roles needed to remotely deploy to the bucket
////////////////////////////////////////////////////////////////////////////////////////////////
export class F3RVAStackS3 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const accountNumber = props!.env?.account;

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

    // Create a CloudFront Origin Access Identity so the bucket can remain private
    const cfOAIName = `${appName}-${envName}-website-distribution-oai`;
    const oai = new cloudfront.OriginAccessIdentity(this, cfOAIName, {
      comment: `OAI for ${websiteBucketName}`
    });

    // Grant CloudFront read access to the bucket
    websiteBucket.grantRead(oai);

    // Create CloudFront distribution in front of the S3 bucket
    const cfDistributionName = `${appName}-${envName}-website-distribution`;
    const cfDistribution = new cloudfront.Distribution(this, cfDistributionName, {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      defaultRootObject: 'index.html'
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // import the GH Actions role ARN and create a role reference
    const ghActionsRoleArn = cdk.Fn.importValue(`${appName}-${envName}-ghActionsRoleArn`);
    const ghActionsRole = iam.Role.fromRoleArn(this, 'ghActionsRole', ghActionsRoleArn, { mutable: true });

    // allow synching to the bucket
    const s3FullAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:GetObjectVersion'],
      resources: [websiteBucket.bucketArn, websiteBucket.bucketArn + '/*']
    });
    ghActionsRole.addToPrincipalPolicy(s3FullAccessPolicy);

    // allow cloudfront distribution invalidation
    const cfResourceArn = `arn:aws:cloudfront::${accountNumber}:distribution/${cfDistribution.distributionId}`;
    const cfInvalidationPolicy = new iam.PolicyStatement({
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
  }
}
