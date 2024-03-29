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
    const rdsSecurityGroupName = `${appName}-${envName}/rds-sg`;
    const rdsSecurityGroup = new ec2.SecurityGroup(this, rdsSecurityGroupName, {
      vpc,
      allowAllOutbound: true,
      description: "Database Security Group"
    });

    // create a tag to name the Security Group
    cdk.Tags.of(rdsSecurityGroup).add('Name', `${rdsSecurityGroupName}`);


    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create database credentials
    const dbAdminSecret = new rds.DatabaseSecret(this, `${id}-admin-credential`, {
      username: "admin",
      secretName: `${envName}/${appName}/dbAdmin`
    });
    const dbBigDataOwnerSecret = new rds.DatabaseSecret(this, `${id}-bd-owner-credential`, {
      username: "bdOwner",
      secretName: `${envName}/${appName}/bdOwner`
    });
    const dbBigDataAppSecret = new rds.DatabaseSecret(this, `${id}-bd-app-credential`, {
      username: "bdApp",
      secretName: `${envName}/${appName}/bdApp`
    });
    const dbWebAppSecret = new rds.DatabaseSecret(this, `${id}-web-app-credential`, {
      username: "webApp",
      secretName: `${envName}/${appName}/bdWeb`
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create database
    const databaseInstanceName = 'web-database';
    const databaseInstance = new rds.DatabaseInstance(this, databaseInstanceName, {
      allocatedStorage: 20,
      credentials: rds.Credentials.fromSecret(dbAdminSecret),
      databaseName: instanceName,
      engine: rds.DatabaseInstanceEngine.MYSQL,
      instanceType: instanceType,
      maxAllocatedStorage: 50,
      preferredBackupWindow: '06:00-07:00', // in UTC
      preferredMaintenanceWindow: 'sun:07:00-sun:08:00', // in UTC
      publiclyAccessible: true,
      securityGroups: [rdsSecurityGroup],
      vpc,
      vpcSubnets: { subnets: vpc.isolatedSubnets }
    });
    cdk.Tags.of(databaseInstance).add("Name", `${appName}-${envName}-${databaseInstanceName}`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);

    ///////////////////////////////////////////////////////////////////////////
    // outputs
    new cdk.CfnOutput(this, 'databaseId', {
      value: databaseInstance.instanceIdentifier,
      exportName: `${appName}-${envName}-webDatabaseId`
    });

    new cdk.CfnOutput(this, 'rdsSecurityGroupId', {
      value: rdsSecurityGroup.securityGroupId,
      exportName: `${appName}-${envName}-rdsSecurityGroupId`
    });
  }
}
