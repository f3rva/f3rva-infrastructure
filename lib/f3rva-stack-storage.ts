import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class F3RVAStackStorage extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'F3RvaBigdataInfrastructureQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
