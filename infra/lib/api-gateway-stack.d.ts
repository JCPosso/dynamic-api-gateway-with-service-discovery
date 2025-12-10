import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
interface ApiGatewayStackProps extends StackProps {
    routerLambda: lambda.Function;
}
export declare class ApiGatewayStack extends Stack {
    constructor(scope: Construct, id: string, props: ApiGatewayStackProps);
}
export {};
