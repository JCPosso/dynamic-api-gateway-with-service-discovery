import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/vpc-stack";
import { DynamoDBStack } from "../lib/dynamodb-stack";
import { EcsClusterStack } from "../lib/ecs-cluster-stack";
import { EcsServiceUsersStack } from "../lib/ecs-service-users-stack";
import { LambdaRouterStack } from "../lib/lambda-router-stack";
import { ApiGatewayStack } from "../lib/api-gateway-stack";

const app = new cdk.App();

const vpc = new VpcStack(app, "VpcStack");
const dynamo = new DynamoDBStack(app, "DynamoDBStack");

const ecsCluster = new EcsClusterStack(app, "EcsClusterStack", {
  vpc: vpc.vpc,
});

new EcsServiceUsersStack(app, "UsersServiceStack", {
  cluster: ecsCluster.cluster,
  vpc: vpc.vpc,
  serviceTable: dynamo.serviceTable,
});

const lambdaRouter = new LambdaRouterStack(app, "LambdaRouterStack", {
  serviceTable: dynamo.serviceTable,
});

new ApiGatewayStack(app, "ApiGatewayStack", {
  routerLambda: lambdaRouter.routerLambda,
});