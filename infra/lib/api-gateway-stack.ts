import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as lambda from "aws-cdk-lib/aws-lambda";

export interface ApiGatewayStackProps extends StackProps {
  routerLambda: lambda.Function;
}

export class ApiGatewayStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    // Integration Lambda → HTTP API
    const lambdaIntegration = new apigwv2Integrations.HttpLambdaIntegration(
      "LambdaRouterIntegration",
      props.routerLambda
    );

    // Create HTTP API
    this.httpApi = new apigwv2.HttpApi(this, "ApiGateway", {
      apiName: "DynamicGateway",
      createDefaultStage: true,
    });

    // ANY /{service}/{proxy+}
    this.httpApi.addRoutes({
      path: "/{service}/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: lambdaIntegration as unknown as apigwv2.HttpRouteIntegration,
    });

    // También permitir raíz para debugging opcional
    this.httpApi.addRoutes({
      path: "/{service}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: lambdaIntegration as unknown as apigwv2.HttpRouteIntegration,
    });

    // Output URL
    new CfnOutput(this, "HttpApiUrl", {
      value: this.httpApi.apiEndpoint,
    });
  }
}
