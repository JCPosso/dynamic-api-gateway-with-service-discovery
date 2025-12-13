import * as cdk from "aws-cdk-lib";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { ApiGatewayStack } from "../lib/api-gateway-stack";
import { LambdaRouterStack } from "../lib/lambda-router-stack";
import { Ec2ServiceStack } from "../lib/ec2-service-stack";

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
const dynamo = new DynamoDbStack(app, "ServiceRegistryStack", { env });
let dynamoTableName = dynamo.serviceRegistry.tableName;
const repoUrl = process.env.SERVICE_GIT_REPO;

const router = new LambdaRouterStack(app, "LambdaRouterStack", {
  env,
  serviceRegistryTableName: dynamoTableName,
});

new ApiGatewayStack(app, "ApiGatewayStack", {
  env,
  routerLambda: router.routerLambda,
});

new Ec2ServiceStack(app, "OrdersEc2Stack", {
  env,
  serviceName: "orders",
  serviceDirectory: "services/orders",
  servicePort: 3001,
  dynamoDbTableName: dynamoTableName,
  gitRepoUrl: repoUrl!,
});

new Ec2ServiceStack(app, "UsersEc2Stack", {
  env,
  serviceName: "users",
  serviceDirectory: "services/users",
  servicePort: 3000,
  dynamoDbTableName: dynamoTableName,
  gitRepoUrl: repoUrl!,
});

new Ec2ServiceStack(app, "UsersEc2Stack2", {
  env,
  serviceName: "users",
  serviceDirectory: "services/users",
  servicePort: 3000,
  dynamoDbTableName: dynamoTableName,
  gitRepoUrl: repoUrl!,
});