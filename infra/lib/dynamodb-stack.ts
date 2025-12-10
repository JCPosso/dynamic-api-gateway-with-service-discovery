import { Stack, StackProps, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class DynamoDbStack extends Stack {
  public readonly serviceRegistry: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.serviceRegistry = new dynamodb.Table(this, "ServiceRegistry", {
      // Partition key: nombre del servicio
      partitionKey: { 
        name: "serviceName", 
        type: dynamodb.AttributeType.STRING 
      },
      // Sort key: instanceId para soportar múltiples instancias
      sortKey: { 
        name: "instanceId", 
        type: dynamodb.AttributeType.STRING 
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      // TTL para limpiar registros obsoletos
      timeToLiveAttribute: "ttl",
    });
  }
}
