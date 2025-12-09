import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";
import * as iam from "aws-cdk-lib/aws-iam";

interface LambdaServiceStackProps extends StackProps {
  serviceName: string;
  codePath: string;
  serviceRegistryTable: dynamodb.Table;
}

export class LambdaServiceStack extends Stack {
  public readonly serviceLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaServiceStackProps) {
    super(scope, id, props);

    const lambdaRole = iam.Role.fromRoleArn(
      this,
      `${props.serviceName}LambdaRole`,
      "arn:aws:iam::646981656470:role/LabRole"
    );

    this.serviceLambda = new lambda.Function(this, `${props.serviceName}Fn`, {
      functionName: `${props.serviceName}-service`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      timeout: Duration.seconds(10),
      memorySize: 256,
      code: lambda.Code.fromAsset(path.join(__dirname, props.codePath)),
      role: lambdaRole,
      environment: {
        SERVICE_NAME: props.serviceName,
        SERVICE_REGISTRY_TABLE: props.serviceRegistryTable.tableName,
      },
    });
  }
}
