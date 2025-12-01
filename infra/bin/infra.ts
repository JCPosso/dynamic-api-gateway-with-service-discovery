import * as cdk from "aws-cdk-lib";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { LambdaRouterStack } from "../lib/lambda-router-stack";
import { ApiGatewayStack } from "../lib/api-gateway-stack";
import { EcsClusterStack } from "@infra/lib/ecs-cluster-stack";
import { EcsServiceUsersStack } from "@infra/lib/ecs-service-users-stack";
import { LambdaSyncStack } from "@infra/lib/lambda-sync-stack";

const app = new cdk.App();

const dynamo = new DynamoDbStack(app, "ServiceRegistryStack");

const ecsCluster = new EcsClusterStack(app, "EcsClusterStack");

const usersService = new EcsServiceUsersStack(app, "UsersServiceStack", {
  cluster: ecsCluster.cluster,
  serviceName: "users",
});

const router = new LambdaRouterStack(app, "LambdaRouterStack", {
  serviceRegistryTable: dynamo.serviceRegistry,
});

new ApiGatewayStack(app, "ApiGatewayStack", {
  routerLambda: router.routerLambda,
});

new LambdaSyncStack(app, "LambdaSyncStack", {
  serviceRegistryTable: dynamo.serviceRegistry,
  clusterName: ecsCluster.cluster.clusterName,
  ecsServiceName: usersService.service.serviceName,
});