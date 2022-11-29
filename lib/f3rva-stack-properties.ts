import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

export interface F3RVAStackProps extends cdk.StackProps {
    appName: 'f3rva',
    envName: 'dev' | 'prod'
}