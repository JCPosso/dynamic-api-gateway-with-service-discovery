import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

interface Props extends StackProps {
  serviceRegistryTable: dynamodb.Table;
  clusterName: string;
  ecsServiceName: string;
}

export class LambdaSyncStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { serviceRegistryTable, clusterName, ecsServiceName } = props;

    const syncLambda = new lambda.Function(this, "SyncLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler.main",
      code: lambda.Code.fromAsset("./lambdas/sync"),
      environment: {
        SERVICE_REGISTRY_TABLE: serviceRegistryTable.tableName,
        ECS_CLUSTER: clusterName,
        ECS_SERVICE_NAME: ecsServiceName,
      },
    });

    serviceRegistryTable.grantWriteData(syncLambda);
  }
}
