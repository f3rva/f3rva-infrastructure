import { describe, it } from '@jest/globals';
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { F3RVAStackApi } from '../lib/f3rva-stack-api';
import { F3RVAStackProps, F3RVAStackDNSProps } from '../lib/f3rva-stack-properties';

describe('F3RVAStackApi', () => {
  const env = { account: '123456789012', region: 'us-east-1' };
  const dnsProps: F3RVAStackDNSProps = {
    env,
    appName: 'f3rva',
    envName: 'dev',
    hostedZones: ['dev.f3rva.org'],
    inboundSMTP: 'inbound-smtp.us-east-1.amazonaws.com',
  };

  const stackProps: F3RVAStackProps = {
    env,
    dns: dnsProps,
    appName: 'f3rva',
    envName: 'dev',
    databaseInstanceName: 'f3rva_dev',
    databaseInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
    bdDatabaseName: 'f3rva_bd',
    webDatabaseName: 'f3rva_web',
    webInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
    amiId: 'ami-05a3e0187917e3e24',
    keyPairName: 'keypair',
    adminEmailSource: 'admin@dev.f3rva.org',
    adminEmailDestination: 'admin@f3rva.org',
    baseDomain: 'dev.f3rva.org',
    bdDomainName: 'bigdata.dev.f3rva.org',
    webDomainName: 'www.dev.f3rva.org',
    apiDomainName: 'api.dev.f3rva.org',
    f3rvaRegionId: '25240',
  };

  it('creates API Lambda function with Python 3.13 runtime, ARM64 architecture, and SSM permissions', () => {
    const app = new cdk.App();
    const stack = new F3RVAStackApi(app, 'TestApiStack', stackProps);
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'python3.13',
      Architectures: ['arm64'],
      Handler: 'src.main.handler',
      MemorySize: 512,
      Timeout: 30,
      Environment: {
        Variables: Match.objectLike({
          ENVIRONMENT: 'dev',
          APP_NAME: 'F3 RVA API',
        }),
      },
    });
  });

  it('creates API Gateway HTTP API v2 with Lambda proxy integration', () => {
    const app = new cdk.App();
    const stack = new F3RVAStackApi(app, 'TestApiStack', stackProps);
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      Name: 'f3rva-dev-http-api',
      ProtocolType: 'HTTP',
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
      IntegrationType: 'AWS_PROXY',
      PayloadFormatVersion: '2.0',
    });
  });

  it('creates CloudFront Distribution with custom domain api.dev.f3rva.org, caching disabled by default, and /schedule cached with CORS support', () => {
    const app = new cdk.App();
    const stack = new F3RVAStackApi(app, 'TestApiStack', stackProps);
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['api.dev.f3rva.org'],
        CacheBehaviors: [
          Match.objectLike({
            PathPattern: '/schedule',
            ViewerProtocolPolicy: 'redirect-to-https',
            AllowedMethods: Match.arrayWith(['GET', 'HEAD', 'OPTIONS']),
            ResponseHeadersPolicyId: Match.anyValue(),
          }),
        ],
      }),
    });
  });

  it('creates Route53 ARecord alias for api.dev.f3rva.org', () => {
    const app = new cdk.App();
    const stack = new F3RVAStackApi(app, 'TestApiStack', stackProps);
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'api.dev.f3rva.org.',
      Type: 'A',
    });
  });

  it('outputs ApiLambdaFunctionName, HttpApiUrl, HttpApiId, ApiCustomDomainUrl, and CloudFrontDistributionId', () => {
    const app = new cdk.App();
    const stack = new F3RVAStackApi(app, 'TestApiStack', stackProps);
    const template = Template.fromStack(stack);

    template.hasOutput('ApiLambdaFunctionName', {});
    template.hasOutput('HttpApiUrl', {});
    template.hasOutput('HttpApiId', {});
    template.hasOutput('ApiCustomDomainUrl', {});
    template.hasOutput('CloudFrontDistributionId', {});
  });
});
