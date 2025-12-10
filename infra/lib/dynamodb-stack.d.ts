import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
export declare class DynamoDbStack extends Stack {
    readonly serviceRegistry: dynamodb.Table;
    constructor(scope: Construct, id: string, props?: StackProps);
}
