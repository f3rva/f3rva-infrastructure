import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface BasePythonLambdaProps {
  /** Path to the code entry directory (e.g. 'src/lambda/schedule_api') */
  readonly entry: string;
  /** Handler function specification (default: 'handler.handler') */
  readonly handler?: string;
  /** Python runtime version (default: PYTHON_3_13) */
  readonly runtime?: lambda.Runtime;
  /** Function execution timeout (default: 10s) */
  readonly timeout?: cdk.Duration;
  /** Memory allocated to function in MB (default: 256) */
  readonly memorySize?: number;
  /** Key-value environment variables */
  readonly environment?: { [key: string]: string };
  /** Optional SSM Parameter Store path to grant read access for (e.g. '/f3rva/dev/f3nation_api_key') */
  readonly ssmParamName?: string;
  /** Authentication type for the function URL (default: AWS_IAM) */
  readonly authType?: lambda.FunctionUrlAuthType;
}

export class BasePythonLambda extends Construct {
  public readonly fn: lambda.Function;
  public readonly fnUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: BasePythonLambdaProps) {
    super(scope, id);

    const runtime = props.runtime || lambda.Runtime.PYTHON_3_13;
    const handler = props.handler || 'handler.handler';
    const timeout = props.timeout || cdk.Duration.seconds(10);
    const memorySize = props.memorySize || 256;

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.fn = new lambda.Function(this, 'Function', {
      runtime,
      handler,
      code: lambda.Code.fromAsset(props.entry),
      timeout,
      memorySize,
      environment: props.environment || {},
      logGroup,
    });

    // Grant SSM Parameter Store access if specified
    if (props.ssmParamName) {
      const ssmPolicy = new iam.PolicyStatement({
        sid: 'AllowSSMParameterRead',
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [`arn:aws:ssm:*:*:parameter${props.ssmParamName}`],
      });
      this.fn.addToRolePolicy(ssmPolicy);
    }

    // Create a Function URL with CORS allowed for web frontends
    const authType = props.authType ?? lambda.FunctionUrlAuthType.AWS_IAM;
    this.fnUrl = this.fn.addFunctionUrl({
      authType,
    });
  }
}
