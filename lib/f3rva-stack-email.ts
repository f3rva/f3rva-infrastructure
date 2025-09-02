import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as actions from 'aws-cdk-lib/aws-ses-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

////////////////////////////////////////////////////////////////////////////////////////////////
// The purpose of this stack is two fold
//
// 1. Create a SES identity for the domain and email address so we can send emails from our domain
// 2. Create a SNS topic and subscription routing all admin emails to a particular destination.
//    This is because we don't have a mail provider setup
////////////////////////////////////////////////////////////////////////////////////////////////
export class F3RVAStackEmail extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const adminEmailSource = props!.adminEmailSource;
    const adminEmailDestination = props!.adminEmailDestination;
    const baseDomain = props!.baseDomain;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Create a user and a policy that allows for sending through SES
    const sendmailUserName = `${appName}-${envName}-sendmail`;
    const sendmailUser = new iam.User(this, sendmailUserName);

    // Define a policy allowing SES SendEmail and SendRawEmail actions
    const sesPolicy = new iam.Policy(this, "SESSendMailPolicy", {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ses:SendBulkEmail',
            'ses:SendEmail', 
            'ses:SendRawEmail'
          ],
          resources: ['*']
        }),
      ],
    });

    // Attach the policy to the user
    sendmailUser.attachInlinePolicy(sesPolicy);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create SES identities for email and domain
    const domainIdentityName = `${appName}-${envName}-domainIdentity`;
    const domainIdentity = new ses.EmailIdentity(this, domainIdentityName, {
      identity: ses.Identity.domain(baseDomain),
    });

    // Email address identity
    const emailIdentityName = `${appName}-${envName}-emailIdentity`;
    const emailIdentity = new ses.EmailIdentity(this, emailIdentityName, {
      identity: ses.Identity.email(adminEmailSource), // Replace with your email address
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create SNS topic and subscription for routed emails
    const emailReceivingTopicName = `${appName}-${envName}-emailReceivingTopic`;
    const emailReceivingTopic = new sns.Topic(this, emailReceivingTopicName, {
      displayName: emailReceivingTopicName
    });
    cdk.Tags.of(emailReceivingTopic).add("NAME", emailReceivingTopicName);

    // now create an email receiver that routes to this topic
    const emailReceiptRuleSetName = `${appName}-${envName}-emailReceiptRuleSet`;
    const ruleSet = new ses.ReceiptRuleSet(this, emailReceiptRuleSetName, {
      receiptRuleSetName: emailReceiptRuleSetName
    });

    // Define the receiving rule
    const emailRuleSettingName = `${appName}-${envName}-forwardAdminEmailsToSNS`;
    const rule = new ses.ReceiptRule(this, emailRuleSettingName, {
      actions: [
        new actions.Sns({
          topic: emailReceivingTopic,
          encoding: actions.EmailEncoding.BASE64
        })
      ],
      enabled: true,
      ruleSet: ruleSet,
      receiptRuleName: emailRuleSettingName,
      recipients: [ adminEmailSource ], // array of email addresses to match
      scanEnabled: true // spam scanning
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create the lambda function and subscribe to the topic
    const forwardEmailLambdaName = `${appName}-${envName}/forwardEmailFromSES`;
    const forwardEmailLambda = new lambda.Function(this, forwardEmailLambdaName, {
      environment: {
        EMAIL_DESTINATION: adminEmailDestination
      },
      code: lambda.Code.fromAsset("src/api/email/forward"),
      handler: 'forward.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_12,
      initialPolicy: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ses:SendBulkEmail',
            'ses:SendEmail', 
            'ses:SendRawEmail'
          ],
          resources: ['*']
        })
      ]
    });
    cdk.Tags.of(forwardEmailLambda).add("Name", forwardEmailLambdaName);

    // subscribe the lambda function to the topic
    emailReceivingTopic.addSubscription(new LambdaSubscription(forwardEmailLambda));

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}