import { Stack, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as path from "path";

export class LambdaSyncStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: {
      cluster: ecs.Cluster;
      serviceTable: dynamodb.Table;
      services: { name: string; port: number }[];
    }
  ) {
    super(scope, id);

    const syncLambda = new lambda.Function(this, "SyncLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      timeout: Duration.seconds(15),
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../lambdas/sync")
      ),
      environment: {
        CLUSTER: props.cluster.clusterName,
        SERVICE_TABLE: props.serviceTable.tableName,
        SERVICES: JSON.stringify(props.services),
      },
    });

    props.serviceTable.grantWriteData(syncLambda);

    new events.Rule(this, "SyncSchedule", {
      schedule: events.Schedule.rate(Duration.minutes(1)),
      targets: [new targets.LambdaFunction(syncLambda)],
    });
  }
}
