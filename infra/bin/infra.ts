import * as cdk from "aws-cdk-lib";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { ApiGatewayStack } from "../lib/api-gateway-stack";
import { LambdaRouterStack } from "../lib/lambda-router-stack";
import { Ec2ServiceStack } from "../lib/ec2-service-stack";

const app = new cdk.App();

// Definir el entorno de AWS (necesario para VPC lookup)
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || "646981656470",
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

const dynamo = new DynamoDbStack(app, "ServiceRegistryStack", { env });

// Repositorio que contiene los servicios Node.js
const repoUrl =
  process.env.SERVICE_GIT_REPO ||
  "https://github.com/JCPosso/dynamic-api-gateway-with-service-discovery.git";

// new Ec2ServiceStack(app, "OrdersEc2Stack", {
//   env,
//   serviceName: "orders",
//   serviceDirectory: "services/orders",
//   servicePort: 3001,
//   serviceRegistryTable: dynamo.serviceRegistry,
//   gitRepoUrl: repoUrl,
// });

new Ec2ServiceStack(app, "UsersEc2Stack", {
  env,
  serviceName: "users",
  serviceDirectory: "services/users",
  servicePort: 3000,
  serviceRegistryTable: dynamo.serviceRegistry,
  gitRepoUrl: repoUrl,
});

const router = new LambdaRouterStack(app, "LambdaRouterStack", {
  env,
  serviceRegistryTable: dynamo.serviceRegistry,
});

new ApiGatewayStack(app, "ApiGatewayStack", {
  env,
  routerLambda: router.routerLambda,
});

