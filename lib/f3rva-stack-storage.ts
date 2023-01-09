import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';


export class F3RVAStackStorage extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    // stack paramerters
    const appName = props!.appName!;
    const envName = props!.envName!;

    
  }
}