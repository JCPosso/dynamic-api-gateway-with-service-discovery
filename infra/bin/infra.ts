import * as cdk from "aws-cdk-lib";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { LambdaRouterStack } from "../lib/lambda-router-stack";
import { ApiGatewayStack } from "../lib/api-gateway-stack";

const app = new cdk.App();

const dynamoStack = new DynamoDbStack(app, "ServiceRegistryStack");

const routerStack = new LambdaRouterStack(app, "LambdaRouterStack", {
  serviceRegistryTable: dynamoStack.serviceRegistry,
});

new ApiGatewayStack(app, "ApiGatewayStack", {
  routerLambda: routerStack.routerLambda,
});
