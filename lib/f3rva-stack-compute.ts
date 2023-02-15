import * as asg from 'aws-cdk-lib/aws-autoscaling';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as fs from 'fs';
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

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
    const vpc = props!.vpc!;
    const webEIP = props!.webEIP!;
    const amiId = props!.amiId;
    const keyPair = props!.keyPair;
    const webCertificate = props!.webCertificate!;
    const bdCertificate = props!.bdCertificate!;

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
      description: "Allow SSH (TCP port 22), HTTP (TCP port 80/443) in",
      allowAllOutbound: true,
    });

    // Allow SSH access on port tcp/22
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH Access"
    );

    // Allow HTTP access on port tcp/80
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP Access"
    );

    // Allow HTTPS access on port tcp/443
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS Access"
    );

    // create a tag to name the Security Group
    cdk.Tags.of(ec2SecurityGroup).add('Name', `${ec2SecurityGroupName}`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // create alb security group
    const albSecurityGroupName = `${appName}-${envName}/alb-sg`;
    const albSecurityGroup = new ec2.SecurityGroup(this, albSecurityGroupName, {
      vpc,
      description: "Allow HTTP (TCP port 80/443) in",
      allowAllOutbound: true,
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
    // const ec2InstanceName = "webApplicationInstance";
    // const ec2Instance = new ec2.Instance(this, ec2InstanceName, {
    //   vpc: vpc,
    //   instanceType: instanceType,
    //   machineImage: ami,
    //   securityGroup: ec2SecurityGroup,
    //   keyName: keyPair,
    //   role: ec2Role
    // });
    const autoscalingName = "asg";
    const autoscaling = new asg.AutoScalingGroup(this, autoscalingName, {
      vpc,
      instanceType: instanceType,
      machineImage: ami,
      autoScalingGroupName: "webAutoScalingGroup",
      securityGroup: ec2SecurityGroup,
      keyName: keyPair,
      role: ec2Role,
      minCapacity: 1,
      maxCapacity: 1 ,
      desiredCapacity: 1,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      }
    });
    cdk.Tags.of(autoscaling).add("Name", `${appName}-${envName}-${autoscalingName}`);

    // create alb
    const lbName = "lb";
    const lb = new elb.ApplicationLoadBalancer(this, lbName, {
      vpc,
      internetFacing: true,
      loadBalancerName: `${appName}-${envName}-${lbName}`,
      securityGroup: albSecurityGroup
    });
    cdk.Tags.of(lb).add("Name", `${appName}-${envName}-${lbName}`);

    // redirect 80 -> 443
    const redirectListener = lb.addRedirect({
      sourceProtocol: elb.ApplicationProtocol.HTTP,
      sourcePort: 80,
      targetProtocol: elb.ApplicationProtocol.HTTPS,
      targetPort: 443
    });

    // add http listener
    const httpListener = lb.addListener("HTTPListener", {
      port: 443,
    });

    // add certificate
    httpListener.addCertificates("webCertificates", [
      webCertificate,
      bdCertificate
    ]
    );

    // route requets to ec2s
    httpListener.addTargets("Target", {
      port: 80,
      targets: [autoscaling]
      // healthCheck: {
      //   path: '/ping',
      //   interval: cdk.Duration.minutes(1),
      // }
    });

    httpListener.connections.allowDefaultPortFromAnyIpv4("Open to the world");

    // configure autoscaling
    autoscaling.scaleOnRequestCount("AModestLoad", {
      targetRequestsPerMinute: 60,
    });
    
    // add startup config
    autoscaling.addUserData(
      `export AWS_REGION=${region}`,
      `export BRANCH_NAME=${branchValue}`,
      `export ENV_NAME=${envName}`,
      `export TAG_NAME=${tagValue}`
    );
    autoscaling.addUserData(
      fs.readFileSync(`./scripts/bootstrap.sh`, "utf8")
    );
    autoscaling.addUserData(      
      `./setup-core.sh`
    );

    // associate instance to EIP
    // const eipAssociation = new ec2.CfnEIPAssociation(this, 'assoc', {
    //   allocationId: webEIP.attrAllocationId,

    //   instanceId: 
    // });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}
