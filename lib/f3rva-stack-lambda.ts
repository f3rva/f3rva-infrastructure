import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

export class F3RVAStackLambda extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;

    // create the lambda function
    const lambdaName = `${appName}-${envName}/helloWorld`;
    const helloLambda = new lambda.Function(this, "helloWorld", {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset("src/api/hello"),
      handler: 'hello.lambda_handler'
    });
    cdk.Tags.of(helloLambda).add("Name", lambdaName);

    // create the API gateway endpoint
    const apiName = `${appName}-${envName}/helloWorldApi`;
    const httpApi = new apigw2.HttpApi(this, "helloWorldApi", {
      apiName: `${appName}-${envName}-helloWorldApi`
    });
    cdk.Tags.of(helloLambda).add("Name", apiName);

    httpApi.addRoutes({
      path: '/hello',
      methods: [ apigw2.HttpMethod.POST ],
      integration: new HttpLambdaIntegration("helloIntegration", helloLambda, {

      }),
    });

    // // Define the API Gateway
    // const api = new apigw.RestApi(this, 'MyApi', {
    //   defaultIntegration: new apigw2.({
    //     handler: myLambda,
    //   }),
    // });

    // // Map root path to the Lambda function
    // const root = api.root.addResource('hello');
    // root.addMethod('GET'); // GET method is automatically integrated with Lambda due to defaultIntegration

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // outputs
    // new cdk.CfnOutput(this, "ec2InstancePublicDNS", {
    //   value: ec2Instance.instancePublicDnsName,
    //   exportName: `${appName}-${envName}-ec2InstancePublicDNS`
    // });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}
