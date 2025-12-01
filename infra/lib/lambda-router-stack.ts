import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

export interface LambdaRouterStackProps extends StackProps {
  serviceTable: dynamodb.Table;
}

export class LambdaRouterStack extends Stack {
  public readonly routerLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaRouterStackProps) {
    super(scope, id, props);

    this.routerLambda = new lambda.Function(this, "LambdaRouter", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../lambdas/router")
      ),
      timeout: Duration.seconds(15),
      memorySize: 512,
      environment: {
        SERVICE_TABLE: props.serviceTable.tableName
      }
    });

    props.serviceTable.grantReadData(this.routerLambda);

    this.routerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ec2:CreateNetworkInterface", "ec2:DescribeNetworkInterfaces", "ec2:DeleteNetworkInterface"],
        resources: ["*"]
      })
    );
  }
}