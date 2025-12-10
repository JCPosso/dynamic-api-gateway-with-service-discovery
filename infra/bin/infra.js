"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb_stack_1 = require("../lib/dynamodb-stack");
const api_gateway_stack_1 = require("../lib/api-gateway-stack");
const lambda_router_stack_1 = require("../lib/lambda-router-stack");
const ec2_service_stack_1 = require("../lib/ec2-service-stack");
const app = new cdk.App();
// Definir el entorno de AWS (necesario para VPC lookup)
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT || "646981656470",
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};
// Si estamos haciendo deploy solo de EC2, no crear las otras stacks
const deployOnlyEC2 = process.env.DEPLOY_ONLY_EC2 === "true";
let dynamoTableName = "ServiceRegistryStack-ServiceRegistryC10B6608-D2AX099FCN8Y";
if (!deployOnlyEC2) {
    const dynamo = new dynamodb_stack_1.DynamoDbStack(app, "ServiceRegistryStack", { env });
    dynamoTableName = dynamo.serviceRegistry.tableName;
}
// Repositorio que contiene los servicios Node.js
const repoUrl = process.env.SERVICE_GIT_REPO ||
    "https://github.com/JCPosso/dynamic-api-gateway-with-service-discovery.git";
new ec2_service_stack_1.Ec2ServiceStack(app, "OrdersEc2Stack", {
    env,
    serviceName: "orders",
    serviceDirectory: "services/orders",
    servicePort: 3001,
    dynamoDbTableName: dynamoTableName,
    gitRepoUrl: repoUrl,
});
new ec2_service_stack_1.Ec2ServiceStack(app, "UsersEc2Stack", {
    env,
    serviceName: "users",
    serviceDirectory: "services/users",
    servicePort: 3000,
    dynamoDbTableName: dynamoTableName,
    gitRepoUrl: repoUrl,
});
new ec2_service_stack_1.Ec2ServiceStack(app, "UsersEc2Stack2", {
    env,
    serviceName: "users",
    serviceDirectory: "services/users",
    servicePort: 3000,
    dynamoDbTableName: dynamoTableName,
    gitRepoUrl: repoUrl,
});
if (!deployOnlyEC2) {
    const router = new lambda_router_stack_1.LambdaRouterStack(app, "LambdaRouterStack", {
        env,
        serviceRegistryTableName: dynamoTableName,
    });
    new api_gateway_stack_1.ApiGatewayStack(app, "ApiGatewayStack", {
        env,
        routerLambda: router.routerLambda,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mcmEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmZyYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLDBEQUFzRDtBQUN0RCxnRUFBMkQ7QUFDM0Qsb0VBQStEO0FBQy9ELGdFQUEyRDtBQUUzRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQix3REFBd0Q7QUFDeEQsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxjQUFjO0lBQzFELE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7Q0FDdEQsQ0FBQztBQUVGLG9FQUFvRTtBQUNwRSxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsS0FBSyxNQUFNLENBQUM7QUFFN0QsSUFBSSxlQUFlLEdBQUcsMkRBQTJELENBQUM7QUFFbEYsSUFBSSxDQUFDLGFBQWEsRUFBRTtJQUNsQixNQUFNLE1BQU0sR0FBRyxJQUFJLDhCQUFhLENBQUMsR0FBRyxFQUFFLHNCQUFzQixFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN2RSxlQUFlLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUM7Q0FDcEQ7QUFFRCxpREFBaUQ7QUFDakQsTUFBTSxPQUFPLEdBQ1gsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0I7SUFDNUIsMkVBQTJFLENBQUM7QUFFOUUsSUFBSSxtQ0FBZSxDQUFDLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRTtJQUN6QyxHQUFHO0lBQ0gsV0FBVyxFQUFFLFFBQVE7SUFDckIsZ0JBQWdCLEVBQUUsaUJBQWlCO0lBQ25DLFdBQVcsRUFBRSxJQUFJO0lBQ2pCLGlCQUFpQixFQUFFLGVBQWU7SUFDbEMsVUFBVSxFQUFFLE9BQU87Q0FDcEIsQ0FBQyxDQUFDO0FBRUgsSUFBSSxtQ0FBZSxDQUFDLEdBQUcsRUFBRSxlQUFlLEVBQUU7SUFDeEMsR0FBRztJQUNILFdBQVcsRUFBRSxPQUFPO0lBQ3BCLGdCQUFnQixFQUFFLGdCQUFnQjtJQUNsQyxXQUFXLEVBQUUsSUFBSTtJQUNqQixpQkFBaUIsRUFBRSxlQUFlO0lBQ2xDLFVBQVUsRUFBRSxPQUFPO0NBQ3BCLENBQUMsQ0FBQztBQUVILElBQUksbUNBQWUsQ0FBQyxHQUFHLEVBQUUsZ0JBQWdCLEVBQUU7SUFDekMsR0FBRztJQUNILFdBQVcsRUFBRSxPQUFPO0lBQ3BCLGdCQUFnQixFQUFFLGdCQUFnQjtJQUNsQyxXQUFXLEVBQUUsSUFBSTtJQUNqQixpQkFBaUIsRUFBRSxlQUFlO0lBQ2xDLFVBQVUsRUFBRSxPQUFPO0NBQ3BCLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQyxhQUFhLEVBQUU7SUFDbEIsTUFBTSxNQUFNLEdBQUcsSUFBSSx1Q0FBaUIsQ0FBQyxHQUFHLEVBQUUsbUJBQW1CLEVBQUU7UUFDN0QsR0FBRztRQUNILHdCQUF3QixFQUFFLGVBQWU7S0FDMUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxtQ0FBZSxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsRUFBRTtRQUMxQyxHQUFHO1FBQ0gsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZO0tBQ2xDLENBQUMsQ0FBQztDQUNKIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0IHsgRHluYW1vRGJTdGFjayB9IGZyb20gXCIuLi9saWIvZHluYW1vZGItc3RhY2tcIjtcbmltcG9ydCB7IEFwaUdhdGV3YXlTdGFjayB9IGZyb20gXCIuLi9saWIvYXBpLWdhdGV3YXktc3RhY2tcIjtcbmltcG9ydCB7IExhbWJkYVJvdXRlclN0YWNrIH0gZnJvbSBcIi4uL2xpYi9sYW1iZGEtcm91dGVyLXN0YWNrXCI7XG5pbXBvcnQgeyBFYzJTZXJ2aWNlU3RhY2sgfSBmcm9tIFwiLi4vbGliL2VjMi1zZXJ2aWNlLXN0YWNrXCI7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIERlZmluaXIgZWwgZW50b3JubyBkZSBBV1MgKG5lY2VzYXJpbyBwYXJhIFZQQyBsb29rdXApXG5jb25zdCBlbnYgPSB7XG4gIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQgfHwgXCI2NDY5ODE2NTY0NzBcIixcbiAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgXCJ1cy1lYXN0LTFcIixcbn07XG5cbi8vIFNpIGVzdGFtb3MgaGFjaWVuZG8gZGVwbG95IHNvbG8gZGUgRUMyLCBubyBjcmVhciBsYXMgb3RyYXMgc3RhY2tzXG5jb25zdCBkZXBsb3lPbmx5RUMyID0gcHJvY2Vzcy5lbnYuREVQTE9ZX09OTFlfRUMyID09PSBcInRydWVcIjtcblxubGV0IGR5bmFtb1RhYmxlTmFtZSA9IFwiU2VydmljZVJlZ2lzdHJ5U3RhY2stU2VydmljZVJlZ2lzdHJ5QzEwQjY2MDgtRDJBWDA5OUZDTjhZXCI7XG5cbmlmICghZGVwbG95T25seUVDMikge1xuICBjb25zdCBkeW5hbW8gPSBuZXcgRHluYW1vRGJTdGFjayhhcHAsIFwiU2VydmljZVJlZ2lzdHJ5U3RhY2tcIiwgeyBlbnYgfSk7XG4gIGR5bmFtb1RhYmxlTmFtZSA9IGR5bmFtby5zZXJ2aWNlUmVnaXN0cnkudGFibGVOYW1lO1xufVxuXG4vLyBSZXBvc2l0b3JpbyBxdWUgY29udGllbmUgbG9zIHNlcnZpY2lvcyBOb2RlLmpzXG5jb25zdCByZXBvVXJsID1cbiAgcHJvY2Vzcy5lbnYuU0VSVklDRV9HSVRfUkVQTyB8fFxuICBcImh0dHBzOi8vZ2l0aHViLmNvbS9KQ1Bvc3NvL2R5bmFtaWMtYXBpLWdhdGV3YXktd2l0aC1zZXJ2aWNlLWRpc2NvdmVyeS5naXRcIjtcblxubmV3IEVjMlNlcnZpY2VTdGFjayhhcHAsIFwiT3JkZXJzRWMyU3RhY2tcIiwge1xuICBlbnYsXG4gIHNlcnZpY2VOYW1lOiBcIm9yZGVyc1wiLFxuICBzZXJ2aWNlRGlyZWN0b3J5OiBcInNlcnZpY2VzL29yZGVyc1wiLFxuICBzZXJ2aWNlUG9ydDogMzAwMSxcbiAgZHluYW1vRGJUYWJsZU5hbWU6IGR5bmFtb1RhYmxlTmFtZSxcbiAgZ2l0UmVwb1VybDogcmVwb1VybCxcbn0pO1xuXG5uZXcgRWMyU2VydmljZVN0YWNrKGFwcCwgXCJVc2Vyc0VjMlN0YWNrXCIsIHtcbiAgZW52LFxuICBzZXJ2aWNlTmFtZTogXCJ1c2Vyc1wiLFxuICBzZXJ2aWNlRGlyZWN0b3J5OiBcInNlcnZpY2VzL3VzZXJzXCIsXG4gIHNlcnZpY2VQb3J0OiAzMDAwLFxuICBkeW5hbW9EYlRhYmxlTmFtZTogZHluYW1vVGFibGVOYW1lLFxuICBnaXRSZXBvVXJsOiByZXBvVXJsLFxufSk7XG5cbm5ldyBFYzJTZXJ2aWNlU3RhY2soYXBwLCBcIlVzZXJzRWMyU3RhY2syXCIsIHtcbiAgZW52LFxuICBzZXJ2aWNlTmFtZTogXCJ1c2Vyc1wiLFxuICBzZXJ2aWNlRGlyZWN0b3J5OiBcInNlcnZpY2VzL3VzZXJzXCIsXG4gIHNlcnZpY2VQb3J0OiAzMDAwLFxuICBkeW5hbW9EYlRhYmxlTmFtZTogZHluYW1vVGFibGVOYW1lLFxuICBnaXRSZXBvVXJsOiByZXBvVXJsLFxufSk7XG5cbmlmICghZGVwbG95T25seUVDMikge1xuICBjb25zdCByb3V0ZXIgPSBuZXcgTGFtYmRhUm91dGVyU3RhY2soYXBwLCBcIkxhbWJkYVJvdXRlclN0YWNrXCIsIHtcbiAgICBlbnYsXG4gICAgc2VydmljZVJlZ2lzdHJ5VGFibGVOYW1lOiBkeW5hbW9UYWJsZU5hbWUsXG4gIH0pO1xuXG4gIG5ldyBBcGlHYXRld2F5U3RhY2soYXBwLCBcIkFwaUdhdGV3YXlTdGFja1wiLCB7XG4gICAgZW52LFxuICAgIHJvdXRlckxhbWJkYTogcm91dGVyLnJvdXRlckxhbWJkYSxcbiAgfSk7XG59XG5cbiJdfQ==