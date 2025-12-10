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
exports.LambdaRouterStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const path = __importStar(require("path"));
class LambdaRouterStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { serviceRegistryTableName } = props;
        // Usar el rol LabRole existente en lugar de crear uno nuevo
        const lambdaRole = iam.Role.fromRoleArn(this, "LambdaExecutionRole", "arn:aws:iam::646981656470:role/LabRole");
        this.routerLambda = new lambda.Function(this, "RouterLambda", {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "handler.main",
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            memorySize: 256,
            code: lambda.Code.fromAsset(path.join(__dirname, "../../lambdas/router"), {
                bundling: {
                    image: lambda.Runtime.NODEJS_18_X.bundlingImage,
                    command: [
                        "bash",
                        "-c",
                        // Install dependencies so aws-sdk is available in the bundle (set cache to writable path)
                        "NPM_CONFIG_CACHE=/tmp/.npm npm install && cp -au . /asset-output",
                    ],
                },
            }),
            role: lambdaRole,
            environment: {
                SERVICE_REGISTRY_TABLE: serviceRegistryTableName,
            },
        });
    }
}
exports.LambdaRouterStack = LambdaRouterStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXJvdXRlci1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxhbWJkYS1yb3V0ZXItc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw2Q0FBMEQ7QUFFMUQsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUMzQywyQ0FBNkI7QUFNN0IsTUFBYSxpQkFBa0IsU0FBUSxtQkFBSztJQUcxQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTZCO1FBQ3JFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSx3QkFBd0IsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUUzQyw0REFBNEQ7UUFDNUQsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQ3JDLElBQUksRUFDSixxQkFBcUIsRUFDckIsd0NBQXdDLENBQ3pDLENBQUM7UUFFRixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQzVELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGNBQWM7WUFDdkIsT0FBTyxFQUFFLHNCQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUM3QixVQUFVLEVBQUUsR0FBRztZQUNmLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxzQkFBc0IsQ0FBQyxFQUFFO2dCQUN4RSxRQUFRLEVBQUU7b0JBQ1IsS0FBSyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLGFBQWE7b0JBQy9DLE9BQU8sRUFBRTt3QkFDUCxNQUFNO3dCQUNOLElBQUk7d0JBQ0osMEZBQTBGO3dCQUMxRixrRUFBa0U7cUJBQ25FO2lCQUNGO2FBQ0YsQ0FBQztZQUNGLElBQUksRUFBRSxVQUFVO1lBQ2hCLFdBQVcsRUFBRTtnQkFDWCxzQkFBc0IsRUFBRSx3QkFBd0I7YUFDakQ7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFyQ0QsOENBcUNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIER1cmF0aW9uIH0gZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcblxuaW50ZXJmYWNlIExhbWJkYVJvdXRlclN0YWNrUHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcbiAgc2VydmljZVJlZ2lzdHJ5VGFibGVOYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBMYW1iZGFSb3V0ZXJTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHJvdXRlckxhbWJkYTogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBMYW1iZGFSb3V0ZXJTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHNlcnZpY2VSZWdpc3RyeVRhYmxlTmFtZSB9ID0gcHJvcHM7XG5cbiAgICAvLyBVc2FyIGVsIHJvbCBMYWJSb2xlIGV4aXN0ZW50ZSBlbiBsdWdhciBkZSBjcmVhciB1bm8gbnVldm9cbiAgICBjb25zdCBsYW1iZGFSb2xlID0gaWFtLlJvbGUuZnJvbVJvbGVBcm4oXG4gICAgICB0aGlzLFxuICAgICAgXCJMYW1iZGFFeGVjdXRpb25Sb2xlXCIsXG4gICAgICBcImFybjphd3M6aWFtOjo2NDY5ODE2NTY0NzA6cm9sZS9MYWJSb2xlXCJcbiAgICApO1xuXG4gICAgdGhpcy5yb3V0ZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiUm91dGVyTGFtYmRhXCIsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyLm1haW5cIixcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vLi4vbGFtYmRhcy9yb3V0ZXJcIiksIHtcbiAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICBpbWFnZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1guYnVuZGxpbmdJbWFnZSxcbiAgICAgICAgICBjb21tYW5kOiBbXG4gICAgICAgICAgICBcImJhc2hcIixcbiAgICAgICAgICAgIFwiLWNcIixcbiAgICAgICAgICAgIC8vIEluc3RhbGwgZGVwZW5kZW5jaWVzIHNvIGF3cy1zZGsgaXMgYXZhaWxhYmxlIGluIHRoZSBidW5kbGUgKHNldCBjYWNoZSB0byB3cml0YWJsZSBwYXRoKVxuICAgICAgICAgICAgXCJOUE1fQ09ORklHX0NBQ0hFPS90bXAvLm5wbSBucG0gaW5zdGFsbCAmJiBjcCAtYXUgLiAvYXNzZXQtb3V0cHV0XCIsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFNFUlZJQ0VfUkVHSVNUUllfVEFCTEU6IHNlcnZpY2VSZWdpc3RyeVRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==