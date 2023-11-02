import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';


export class F3RVAStackDatabase extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const instanceName = props!.databaseInstanceName;
    const instanceType = props!.databaseInstanceType;
    const vpc = props!.vpc!;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create database security group
    const dbSecurityGroupName = `${appName}-${envName}/db-sg`;
    const dbSecurityGroup = new ec2.SecurityGroup(this, dbSecurityGroupName, {
      vpc,
      allowAllOutbound: true,
      description: "Database Security Group"
    });

    // Allow HTTP access on port tcp/80
    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3306),
      "Allow MYSQL Access"
    );

    // create a tag to name the Security Group
    cdk.Tags.of(dbSecurityGroup).add('Name', `${dbSecurityGroupName}`);


    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create database
    const databaseInstanceName = 'web-database';
    const databaseInstance = new rds.DatabaseInstance(this, databaseInstanceName, {
      allocatedStorage: 20,
      credentials: rds.Credentials.fromUsername('admin', { password: cdk.SecretValue.unsafePlainText('ozFD0%&7AHVi') }),
      databaseName: instanceName,
      engine: rds.DatabaseInstanceEngine.MYSQL,
      instanceType: instanceType,
      maxAllocatedStorage: 50,
      preferredBackupWindow: '06:00-07:00', // in UTC
      preferredMaintenanceWindow: 'sun:07:00-sun:08:00', // in UTC
      publiclyAccessible: true,
      securityGroups: [dbSecurityGroup],
      vpc,
      vpcSubnets: { subnets: vpc.publicSubnets }
    });
    cdk.Tags.of(databaseInstance).add("Name", `${appName}-${envName}-${databaseInstanceName}`);

    ///////////////////////////////////////////////////////////////////////////
    // outputs
    new cdk.CfnOutput(this, 'databaseId', {
      value: databaseInstance.instanceIdentifier,
      exportName: `${appName}-${envName}-webDatabaseId`
    });
  }
}