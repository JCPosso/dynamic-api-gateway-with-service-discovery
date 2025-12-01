import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";

interface LambdaRouterStackProps extends StackProps {
  serviceRegistryTable: dynamodb.Table;
}

export class LambdaRouterStack extends Stack {
  public readonly routerLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaRouterStackProps) {
    super(scope, id, props);

    const { serviceRegistryTable } = props;

    this.routerLambda = new lambda.Function(this, "RouterLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler.main",
      timeout: Duration.seconds(10),
      memorySize: 256,
      code: lambda.Code.fromAsset(path.join(__dirname, "../../lambdas/router")),
      environment: {
        SERVICE_REGISTRY_TABLE: serviceRegistryTable.tableName,
      },
    });

    serviceRegistryTable.grantReadData(this.routerLambda);

    this.routerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: ["*"],
      })
    );
  }
}
