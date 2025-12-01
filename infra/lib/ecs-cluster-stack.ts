import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class EcsClusterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // TODO: crear ECS Cluster
  }
}
