import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';


export class F3RVAStackStorage extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const webDomainName = props!.webDomainName;
    const vpc = props!.vpc!;
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // EFS File System and Access Point
    const efsSecurityGroupName = `${appName}-${envName}/efs-sg`
    const efsSecurityGroup = new ec2.SecurityGroup(this, efsSecurityGroupName, {
      vpc,
      allowAllOutbound: true,
      description: "EFS Security Group"
    });
    cdk.Tags.of(efsSecurityGroup).add("Name", efsSecurityGroupName)
    
    // create filesystem
    const fileSystemName = `${appName}-${envName}/wp-efs`;
    const fileSystem = new efs.FileSystem(this, "wp-efs-file-system", {
      fileSystemName: fileSystemName,
      vpc,
      enableAutomaticBackups: true,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      vpcSubnets: { subnets: vpc.publicSubnets },
      securityGroup: efsSecurityGroup
    });
    
    // create access point
    const accessPointName = `${appName}-${envName}/wp-efs-access-point`;
    const accessPoint = new efs.AccessPoint(this, "wp-efs-access-point", {
      path: `/app/${webDomainName}`,
      createAcl: {
        ownerUid: "1000",
        ownerGid: "1000",
        permissions: "2775"
      },
      posixUser: {
        uid: "1000",
        gid: "1000",
      },
      fileSystem: fileSystem
    });
    cdk.Tags.of(accessPoint).add("Name", accessPointName);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);

    ///////////////////////////////////////////////////////////////////////////
    // outputs
    new cdk.CfnOutput(this, 'fileSystemId', {
      value: fileSystem.fileSystemId,
      exportName: `${appName}-${envName}-wpEfsFileSystemId`
    });

    new cdk.CfnOutput(this, 'accessPointId', {
      value: accessPoint.accessPointId,
      exportName: `${appName}-${envName}-wpEfsAccessPointId`
    });

    new cdk.CfnOutput(this, 'efsSecurityGroupId', {
      value: efsSecurityGroup.securityGroupId,
      exportName: `${appName}-${envName}-wpEfsSecurityGroupId`
    });
  }
}