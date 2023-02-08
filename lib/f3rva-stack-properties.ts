import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

export interface F3RVAStackProps extends cdk.StackProps {
    appName: 'f3rva',
    envName: 'dev' | 'prod',
    webInstanceType: ec2.InstanceType,
    vpc?: ec2.Vpc,
    securityGroup?: ec2.SecurityGroup,
    webEIP?: ec2.CfnEIP,
    amiId: string,
    keyPair: string
}