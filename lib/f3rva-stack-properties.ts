import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as cm from 'aws-cdk-lib/aws-certificatemanager'

export interface F3RVAStackProps extends cdk.StackProps {
    appName: 'f3rva',
    envName: 'dev' | 'prod',
    webInstanceType: ec2.InstanceType,
    vpc?: ec2.Vpc,
    webEIP?: ec2.CfnEIP,
    webCertificate?: cm.Certificate,
    bdCertificate?: cm.Certificate,
    amiId: string,
    keyPair: string,
    bdDomainName: string,
    webDomainName: string
}