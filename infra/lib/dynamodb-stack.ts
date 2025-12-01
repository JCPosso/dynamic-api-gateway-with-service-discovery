import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class DynamoDbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // TODO: crear tabla DynamoDB
  }
}
