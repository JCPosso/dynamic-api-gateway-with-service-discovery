import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
interface LambdaRouterStackProps extends StackProps {
    serviceRegistryTableName: string;
}
export declare class LambdaRouterStack extends Stack {
    readonly routerLambda: lambda.Function;
    constructor(scope: Construct, id: string, props: LambdaRouterStackProps);
}
export {};
