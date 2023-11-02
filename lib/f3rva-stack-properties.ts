import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

export interface F3RVAStackProps extends cdk.StackProps {
    appName: 'f3rva',
    envName: 'dev' | 'prod',
    databaseInstanceName: string,
    databaseInstanceType: ec2.InstanceType,
    bdDatabaseName: string,
    webDatabaseName: string,
    webInstanceType: ec2.InstanceType,
    vpc?: ec2.Vpc,
    amiId: string,
    keyPair: string,
    bdDomainName: string,
    webDomainName: string
}