import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';
import * as iam from 'aws-cdk-lib/aws-iam';

//
// Stack to create security dependencies
//
export class F3RVAStackSecurity extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;

    const GITHUB_DOMAIN = 'token.actions.githubusercontent.com';
    const CLIENT_ID = 'sts.amazonaws.com';

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create iam provider for github actions to be able to access roles
    const oidcProviderName = `${appName}-${envName}-oidcProvider`;
    const oidcProvider = new iam.OpenIdConnectProvider(this, oidcProviderName, {
      url: `https://${GITHUB_DOMAIN}`,
      clientIds: [CLIENT_ID],
    });
    cdk.Tags.of(oidcProvider).add('Name', `${appName}-${envName}-${oidcProviderName}`);

    // create the principal with the required conditions
    const allowedRepositories = [
      'repo:f3rva/f3rva-website:*',
    ];
    
    // create the conditions for the principal
    const conditions: iam.Conditions = {
      StringEquals: {
        [`${GITHUB_DOMAIN}:aud`]: CLIENT_ID,
      },
      StringLike: {
        [`${GITHUB_DOMAIN}:sub`]: allowedRepositories,
      },
    };
    const oidcPrincipal = new iam.OpenIdConnectPrincipal(oidcProvider).withConditions(conditions);

    // create the role
    const ghActionsRoleName = 'ghActionsRole';
    const ghActionsRole = new iam.Role(this, ghActionsRoleName, {
      assumedBy: oidcPrincipal,
      description: 'Role assumed by github actions to perform deployments'
    });
    cdk.Tags.of(ghActionsRole).add('Name', `${appName}-${envName}-${ghActionsRoleName}`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);

    ///////////////////////////////////////////////////////////////////////////
    // output
    new cdk.CfnOutput(this, 'oidcProviderArn', {
      value: oidcProvider.openIdConnectProviderArn,
      exportName: `${appName}-${envName}-oidcProviderArn`
    });

    new cdk.CfnOutput(this, 'ghActionsRoleArn', {
      value: ghActionsRole.roleArn,
      exportName: `${appName}-${envName}-ghActionsRoleArn`
    });
  }
}
