import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as efs from 'aws-cdk-lib/aws-efs'
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';


export class F3RVAStackStorage extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const vpc = props!.vpc!;
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // EFS File System and Access Point
    const efsSecurityGroupName = `${appName}-${envName}-efs-sg`
    const efsSecurityGroup = new ec2.SecurityGroup(this, efsSecurityGroupName, {
      vpc,
      allowAllOutbound: true,
      securityGroupName: efsSecurityGroupName,
      description: efsSecurityGroupName,
    })
    
    // create filesystem
    const fileSystemName = `${appName}-${envName}-efs`
    const fileSystem = new efs.FileSystem(this, 'efs-file-system', {
      fileSystemName: fileSystemName,
      vpc,
      enableAutomaticBackups: true,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      vpcSubnets: { subnets: vpc.isolatedSubnets },
      securityGroup: efsSecurityGroup
    })
    
    // create access point
    const accessPoint = new efs.AccessPoint(this, 'efs-access-point', {
      path: '/bitnami',
      createAcl: {
        ownerUid: '1001',
        ownerGid: '1001',
        permissions: '0777'
      },
      posixUser: {
        uid: '1001',
        gid: '1001',
      },
      fileSystem: fileSystem,
    })

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}