import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";

interface ApiGatewayStackProps extends StackProps {
  routerLambda: lambda.Function;
}

export class ApiGatewayStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { routerLambda } = props;

    new apigateway.LambdaRestApi(this, "ApiGateway", {
      restApiName: "AutoConfigurableGateway",
      handler: routerLambda,
      proxy: true,
      deployOptions: {
        stageName: "dev",
        throttlingRateLimit: 20,
        throttlingBurstLimit: 40,
      },
    });
  }
}
