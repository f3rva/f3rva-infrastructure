import * as cdk from 'aws-cdk-lib';
import * as cm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

export class F3RVAStackApi extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Stack properties
    const appName = props!.appName;
    const envName = props!.envName;
    const accountNumber = props!.env?.account;
    const region = props!.env?.region;
    const apiDomainName = props!.apiDomainName;
    const baseDomain = props!.baseDomain;
    const ssmParamPath = `/f3rva/${envName}/*`;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/aws/lambda/${appName}-${envName}-api-lambda`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // REST API Lambda Function
    // Initial inline bootstrap handler allows CDK to deploy before the first GitHub Actions build
    const apiLambdaName = `${appName}-${envName}-api-lambda`;
    const apiLambda = new lambda.Function(this, apiLambdaName, {
      functionName: apiLambdaName,
      runtime: lambda.Runtime.PYTHON_3_13,
      architecture: lambda.Architecture.ARM_64,
      handler: 'src.main.handler',
      code: lambda.Code.fromInline(
        'def handler(event, context):\n    return {"statusCode": 200, "headers": {"Content-Type": "application/json"}, "body": \'{"status":"initializing"}\'}\n'
      ),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        APP_NAME: 'F3 RVA API',
        ENVIRONMENT: envName,
        DEBUG: envName === 'dev' ? 'true' : 'false',
        PORT: '8000',
      },
      logGroup,
    });

    // Grant SSM Parameter Store read access for /f3rva/{env}/*
    const ssmPolicy = new iam.PolicyStatement({
      sid: 'AllowSSMParameterRead',
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
      resources: [`arn:aws:ssm:${region}:${accountNumber}:parameter${ssmParamPath}`],
    });
    apiLambda.addToRolePolicy(ssmPolicy);

    // Create Function URL with AWS_IAM auth (requests signed via SigV4 by CloudFront OAC)
    const apiLambdaUrl = apiLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Import Wildcard Certificate created by F3RVAStackCertificates
    const wildcardCertArn = cdk.Fn.importValue(`${appName}-${envName}-wildcardCertificateArn`);
    const wildcardCertName = `${appName}-${envName}-api-wildcardCert`;
    const certificate = cm.Certificate.fromCertificateArn(this, wildcardCertName, wildcardCertArn);

    // Look up the base hosted zone (dev.f3rva.org or f3rva.org)
    const hostedZoneName = `${appName}-${envName}-api-baseHostedZone`;
    const hostedZone = route53.HostedZone.fromLookup(this, hostedZoneName, {
      domainName: baseDomain,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Create CloudFront FunctionUrlOriginAccessControl (OAC) to sign requests via SigV4
    const oacName = `${appName}-${envName}-api-oac`;
    const oac = new cloudfront.FunctionUrlOriginAccessControl(this, oacName, {
      originAccessControlName: oacName,
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // CloudFront Distribution mapping api.dev.f3rva.org / api.f3rva.org (Single Unified Origin)
    const cfDistributionName = `${appName}-${envName}-api-distribution`;
    const cfDistribution = new cloudfront.Distribution(this, cfDistributionName, {
      domainNames: [apiDomainName],
      certificate,
      defaultBehavior: {
        origin: origins.FunctionUrlOrigin.withOriginAccessControl(apiLambdaUrl, {
          originAccessControl: oac,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });
    cdk.Tags.of(cfDistribution).add('Name', cfDistributionName);

    // Grant CloudFront OAC permission to invoke the Lambda Function URL via resource policy
    apiLambda.addPermission('AllowCloudFrontOAC', {
      principal: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
      action: 'lambda:InvokeFunctionUrl',
      sourceArn: `arn:aws:cloudfront::${accountNumber}:distribution/${cfDistribution.distributionId}`,
    });

    apiLambda.addPermission('AllowCloudFrontOACInvoke', {
      principal: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:cloudfront::${accountNumber}:distribution/${cfDistribution.distributionId}`,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Route53 Alias Record pointing api.dev.f3rva.org -> CloudFront Distribution
    const aRecordName = `${appName}-${envName}-api-aRecord`;
    new route53.ARecord(this, aRecordName, {
      zone: hostedZone,
      recordName: 'api',
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(cfDistribution)),
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // import the GH Actions role ARN and create a role reference
    const ghActionsRoleArn = cdk.Fn.importValue(`${appName}-${envName}-ghActionsRoleArn`);
    const ghActionsRole = iam.Role.fromRoleArn(this, 'apiGhActionsRole', ghActionsRoleArn, { mutable: true });

    // allow lambda update
    const lambdaUpdatePolicy = new iam.PolicyStatement({
      sid: 'AllowGHActionLambdaUpdate',
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:UpdateFunctionCode',
        'lambda:GetFunction',
        'lambda:GetFunctionConfiguration',
      ],
      resources: [apiLambda.functionArn],
    });
    ghActionsRole.addToPrincipalPolicy(lambdaUpdatePolicy);

    // allow cloudfront distribution invalidation
    const cfResourceArn = `arn:aws:cloudfront::${accountNumber}:distribution/${cfDistribution.distributionId}`;
    const cfInvalidationPolicy = new iam.PolicyStatement({
      sid: 'AllowGHActionInvalidation',
      effect: iam.Effect.ALLOW,
      actions: ['cloudfront:CreateInvalidation'],
      resources: [cfResourceArn],
    });
    ghActionsRole.addToPrincipalPolicy(cfInvalidationPolicy);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Tags
    cdk.Tags.of(this).add('APPLICATION', appName);
    cdk.Tags.of(this).add('ENVIRONMENT', envName);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Outputs & Exports
    new cdk.CfnOutput(this, 'ApiLambdaFunctionName', {
      value: apiLambda.functionName,
      exportName: `${appName}-${envName}-ApiLambdaFunctionName`,
    });

    new cdk.CfnOutput(this, 'ApiLambdaFunctionUrl', {
      value: apiLambdaUrl.url,
      exportName: `${appName}-${envName}-ApiLambdaFunctionUrl`,
    });

    new cdk.CfnOutput(this, 'ApiCustomDomainUrl', {
      value: `https://${apiDomainName}`,
      exportName: `${appName}-${envName}-ApiCustomDomainUrl`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: cfDistribution.distributionId,
      exportName: `${appName}-${envName}-ApiCloudFrontDistributionId`,
    });
  }
}
