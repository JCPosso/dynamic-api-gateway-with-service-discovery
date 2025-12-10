import { Stack, StackProps, aws_ec2 as ec2 } from "aws-cdk-lib";
import { Construct } from "constructs";
interface Ec2ServiceStackProps extends StackProps {
    serviceName: string;
    serviceDirectory: string;
    servicePort: number;
    dynamoDbTableName: string;
    gitRepoUrl: string;
}
export declare class Ec2ServiceStack extends Stack {
    readonly instance: ec2.Instance;
    constructor(scope: Construct, id: string, props: Ec2ServiceStackProps);
}
export {};
