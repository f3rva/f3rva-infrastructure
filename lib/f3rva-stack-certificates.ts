import * as cdk from 'aws-cdk-lib';
import * as cm from 'aws-cdk-lib/aws-certificatemanager'
import { Construct } from 'constructs';
import { F3RVAStackProps } from './f3rva-stack-properties';

export class F3RVAStackCertificates extends cdk.Stack {
  // properties that can be shared to other stacks
  public readonly bdCertificate: cm.Certificate;
  public readonly webCertificate: cm.Certificate;
  public readonly wildcardCertificate: cm.Certificate;

  constructor(scope: Construct, id: string, props?: F3RVAStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // stack props
    const appName = props!.appName;
    const envName = props!.envName;
    const bdDomainName = props!.bdDomainName;
    const webDomainName = props!.webDomainName;
    const wildcardDomainName = "*.f3rva.org";
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // wildcard certificate
    this.wildcardCertificate = new cm.Certificate(this, "WebsiteCertificate", {
      domainName: wildcardDomainName,
      subjectAlternativeNames: [
        "f3rva.org"
      ],
      certificateName: `${appName}-${envName}-wildcardCert`
      // validation: cm.CertificateValidation.fromEmail({
      //   "*.f3rva.org": wildcardDomainName
      // })
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // web certificate
    // this.webCertificate = new cm.Certificate(this, "WebsiteCertificate", {
    //   domainName: webDomainName,
    //   validation: cm.CertificateValidation.fromEmail({
    //     "f3rva.org": webDomainName
    //   })
    // });
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // bd certificate
    // this.bdCertificate = new cm.Certificate(this, "BigDataCertificate", {
    //   domainName: bdDomainName,
    //   validation: cm.CertificateValidation.fromEmail({
    //     "f3rva.org": bdDomainName
    //   })
    // });
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // outputs
    new cdk.CfnOutput(this, "WildcardCertificateArn", {
      value: this.wildcardCertificate.certificateArn,
      exportName: `${appName}-${envName}-wildcardCertificateArn`
    });

    // new cdk.CfnOutput(this, "WebCertificateArn", {
    //   value: this.webCertificate.certificateArn,
    //   exportName: `${appName}-${envName}-webCertificateArn`
    // });

    // new cdk.CfnOutput(this, "BigDataCertificateArn", {
    //   value: this.bdCertificate.certificateArn,
    //   exportName: `${appName}-${envName}-bdCertificateArn`
    // });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // tag to all resources created by this stack
    cdk.Tags.of(this).add("APPLICATION", appName);
    cdk.Tags.of(this).add("ENVIRONMENT", envName);
  }
}