import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EcsClusterStack } from '../lib/ecs-cluster-stack';
import { DynamoDbStack } from '../lib/dynamodb-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { LambdaRouterStack } from '../lib/lambda-router-stack';
import { LambdaSyncStack } from '../lib/lambda-sync-stack';

const app = new cdk.App();
new VpcStack(app, 'VpcStack');
new EcsClusterStack(app, 'EcsClusterStack');
new DynamoDbStack(app, 'DynamoDbStack');
new LambdaRouterStack(app, 'LambdaRouterStack');
new LambdaSyncStack(app, 'LambdaSyncStack');
new ApiGatewayStack(app, 'ApiGatewayStack');
