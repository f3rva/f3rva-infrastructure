import * as asg from 'aws-cdk-lib/aws-autoscaling';
import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cm from 'aws-cdk-lib/aws-certificatemanager'
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as fs from 'fs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';
import { ViewerCertificate } from 'aws-cdk-lib/aws-cloudfront';

export class F3RVAStackCompute extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack parameters
    const tag = new cdk.CfnParameter(this, "tag", {
      type: "String",
      default: "",
      description: "OPTIONAL: The tag to use for the build. Required if branch is not specified."});
    const tagValue = tag.valueAsString;
  
    const branch = new cdk.CfnParameter(this, "branch", {
      type: "String",
      default: "",
      description: "OPTIONAL: The branch to pull from for this build"});
    const branchValue = branch.valueAsString;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const region = props!.env!.region!;
    const instanceType = props!.webInstanceType!;
    const amiId = props!.amiId;
    const keyPair = props!.keyPair;
    const vpc = props!.vpc!;
    const bdDomainName = props!.bdDomainName;
    const webDomainName = props!.webDomainName;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack inputs
    const wpEfsFileSystemId = cdk.Fn.importValue(`${appName}-${envName}-wpEfsFileSystemId`);
    const wpEfsSecurityGroupId = cdk.Fn.importValue(`${appName}-${envName}-wpEfsSecurityGroupId`);
    const webCertificateArn = cdk.Fn.importValue(`${appName}-${envName}-webCertificateArn`);
    const bdCertificateArn = cdk.Fn.importValue(`${appName}-${envName}-bdCertificateArn`);
    const wildcardCertificateArn = cdk.Fn.importValue(`${appName}-${envName}-wildcardCertificateArn`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Look up the AMI Id
    const amiMap: Record<string, string> = {
      "us-east-1": amiId
    }
    const ami = ec2.MachineImage.genericLinux(amiMap);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create ec2 security group
    const ec2SecurityGroupName = `${appName}-${envName}/ec2-sg`;
    const ec2SecurityGroup = new ec2.SecurityGroup(this, ec2SecurityGroupName, {
      vpc,
      allowAllOutbound: true,
      description: "EC2 Security Group"
    });

    // Allow SSH access on port tcp/22
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH Access"
    );

    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP Access"
    );

    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS Access"
    );

    // create a tag to name the Security Group
    cdk.Tags.of(ec2SecurityGroup).add('Name', `${ec2SecurityGroupName}`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Update EFS security group to allow access from EC2 instances
    const efsSecurityGroupName = `${appName}-${envName}/efs-sg`;
    const efsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, efsSecurityGroupName, wpEfsSecurityGroupId);
    efsSecurityGroup.connections.allowFrom(ec2SecurityGroup, ec2.Port.tcp(2049), "Allow connections from the EC2 instances");

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create alb security group
    const albSecurityGroupName = `${appName}-${envName}/alb-sg`;
    const albSecurityGroup = new ec2.SecurityGroup(this, albSecurityGroupName, {
      vpc,
      allowAllOutbound: true,
      description: "ALB Security Group"
    });

    // Allow HTTP access on port tcp/80
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP Access"
    );

    // Allow HTTPS access on port tcp/443
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS Access"
    );

    // create a tag to name the Security Group
    cdk.Tags.of(albSecurityGroup).add('Name', `${albSecurityGroupName}`);
  
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Create a secrets policy statement
    const secretsReadPolicyStatement = new iam.PolicyStatement({
      actions: [
        "secretsmanager:GetResourcePolicy",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecretVersionIds"
      ],
      // grant all secrets for the account
      resources: [`arn:aws:secretsmanager:*:${props!.env!.account}:secret:*`]
    });

    // create a managed policy
    const webApplicationPolicyName = "webApplicationPolicy";
    const webApplicationPolicy = new iam.ManagedPolicy(this, webApplicationPolicyName, {
      statements: [
        secretsReadPolicyStatement
      ]
    });
    cdk.Tags.of(webApplicationPolicy).add("Name", `${appName}-${envName}-${webApplicationPolicyName}`);

    // Create an IAM role for this instance and attach policy
    const ec2RoleName = "webApplicationInstanceRole";
    const ec2Role = new iam.Role(this, ec2RoleName , {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM role for web instances'
    });
    ec2Role.addManagedPolicy(webApplicationPolicy);
    cdk.Tags.of(ec2Role).add("Name", `${appName}-${envName}-${ec2RoleName}`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create the ec2 instance
    const ec2InstanceName = "webApplicationInstance";
    const ec2Instance = new ec2.Instance(this, ec2InstanceName, {
      vpc: vpc,
      instanceType: instanceType,
      machineImage: ami,
      securityGroup: ec2SecurityGroup,
      keyName: keyPair,
      role: ec2Role
    });
    cdk.Tags.of(ec2Instance).add("Name", `${appName}-${envName}-${ec2InstanceName}`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create the asg - either use this or the ec2 above
    // const autoscalingName = "asg";
    // const autoscaling = new asg.AutoScalingGroup(this, autoscalingName, {
    //   vpc,
    //   instanceType: instanceType,
    //   machineImage: ami,
    //   autoScalingGroupName: "webAutoScalingGroup",
    //   securityGroup: ec2SecurityGroup,
    //   keyName: keyPair,
    //   role: ec2Role,
    //   minCapacity: 1,
    //   maxCapacity: 1 ,
    //   vpcSubnets: {
    //     subnetType: ec2.SubnetType.PUBLIC
    //   }
    // });
    // cdk.Tags.of(autoscaling).add("Name", `${appName}-${envName}-${autoscalingName}`);

    // create alb
    // const lbName = "lb";
    // const lb = new elb.ApplicationLoadBalancer(this, lbName, {
    //   vpc,
    //   internetFacing: true,
    //   loadBalancerName: `${appName}-${envName}-${lbName}`,
    //   securityGroup: albSecurityGroup
    // });
    // cdk.Tags.of(lb).add("Name", `${appName}-${envName}-${lbName}`);

    // redirect 80 -> 443
    // const redirectListener = lb.addRedirect({
    //   sourceProtocol: elb.ApplicationProtocol.HTTP,
    //   sourcePort: 80,
    //   targetProtocol: elb.ApplicationProtocol.HTTPS,
    //   targetPort: 443
    // });

    // // add http listener
    // const webCertificate = cm.Certificate.fromCertificateArn(this, "WebsiteCertificate", webCertificateArn);
    // const bdCertificate = cm.Certificate.fromCertificateArn(this, "BigDataCertificate", bdCertificateArn);
    // const httpListener = lb.addListener("HTTPListener", {
    //   port: 443,
    //   certificates: [
    //     webCertificate,
    //     bdCertificate
    //   ]
    // });

    // // route requests to ec2s
    // httpListener.addTargets("Target", {
    //   port: 80,
    //   targets: [autoscaling]
    //   // healthCheck: {
    //   //   path: '/ping',
    //   //   interval: cdk.Duration.minutes(1),
    //   // }
    // });

    // httpListener.connections.allowDefaultPortFromAnyIpv4("Open to the world");

    // // configure autoscaling
    // autoscaling.scaleOnRequestCount("AModestLoad", {
    //   targetRequestsPerMinute: 60,
    // });
    
    // add startup config
    ec2Instance.addUserData(
      `export AWS_REGION=${region}`,
      `export BRANCH_NAME=${branchValue}`,
      `export ENV_NAME=${envName}`,
      `export TAG_NAME=${tagValue}`,
      `export WP_EFS_FS_ID=${wpEfsFileSystemId}`
    );
    ec2Instance.addUserData(
      fs.readFileSync(`./scripts/bootstrap.sh`, "utf8")
    );
    ec2Instance.addUserData(      
      `./setup-core.sh`
    );

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // outputs
    new cdk.CfnOutput(this, "ec2InstancePublicDNS", {
      value: ec2Instance.instancePublicDnsName,
      exportName: `${appName}-${envName}-ec2InstancePublicDNS`
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}
