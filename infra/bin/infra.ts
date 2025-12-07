import * as cdk from "aws-cdk-lib";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { LambdaRouterStack } from "../lib/lambda-router-stack";
import { ApiGatewayStack } from "../lib/api-gateway-stack";
import { EcsClusterStack } from "../lib/ecs-cluster-stack";
import { EcsServiceUsersStack } from "../lib/ecs-service-users-stack";
import { LambdaSyncStack } from "@infra/lib/lambda-sync-stack";
import { EcsServiceOrdersStack } from "@infra/lib/ecs-service-orders-stack";

const app = new cdk.App();

const dynamo = new DynamoDbStack(app, "ServiceRegistryStack");
const ecsCluster = new EcsClusterStack(app, "EcsClusterStack");

const usersService = new EcsServiceUsersStack(app, "UsersServiceStack", {
  cluster: ecsCluster.cluster,
  serviceName: "users",
});
new LambdaSyncStack(app, "UsersSyncStack", {
  serviceRegistryTable: dynamo.serviceRegistry,
  clusterName: ecsCluster.cluster.clusterName,
  ecsServiceName: usersService.service.serviceName,
});

const router = new LambdaRouterStack(app, "LambdaRouterStack", {
  serviceRegistryTable: dynamo.serviceRegistry,
});

new ApiGatewayStack(app, "ApiGatewayStack", {
  routerLambda: router.routerLambda,
});

const ordersService = new EcsServiceOrdersStack(app, "OrdersServiceStack", {
  cluster: ecsCluster.cluster,
  serviceName: "orders",
});
new LambdaSyncStack(app, "OrdersSyncStack", {
  serviceRegistryTable: dynamo.serviceRegistry,
  clusterName: ecsCluster.cluster.clusterName,
  ecsServiceName: ordersService.service.serviceName,
});
