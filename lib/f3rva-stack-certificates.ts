import * as cdk from 'aws-cdk-lib';
import * as cm from 'aws-cdk-lib/aws-certificatemanager'
import { CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

export class F3RVAStackCertificates extends cdk.Stack {
  // properties that can be shared to other stacks
  public readonly webCertificate: cm.Certificate;
  public readonly bdCertificate: cm.Certificate;

  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const bdDomainName = props!.bdDomainName;
    const webDomainName = props!.webDomainName;
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // web certificate
    this.webCertificate = new cm.Certificate(this, "WebsiteCertificate", {
      domainName: webDomainName,
      validation: CertificateValidation.fromEmail({
        "f3rva.org": webDomainName
      })
    });
    
    new cdk.CfnOutput(this, "WebCertificateArn", {
      value: this.webCertificate.certificateArn,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // bd certificate
    this.bdCertificate = new cm.Certificate(this, "BigDataCertificate", {
      domainName: bdDomainName,
      validation: CertificateValidation.fromEmail({
        "f3rva.org": bdDomainName
      })
    });
    
    new cdk.CfnOutput(this, "BigDataCertificateArn", {
      value: this.bdCertificate.certificateArn,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}