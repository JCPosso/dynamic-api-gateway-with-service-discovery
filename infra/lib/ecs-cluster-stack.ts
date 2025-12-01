// ec2 services stack placeholderimport { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Stack, StackProps } from "aws-cdk-lib";

export class EcsClusterStack extends Stack {
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
    });

    this.cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: "demo-ecs-ec2",
    });

    this.cluster.addCapacity("DefaultAutoScalingGroup", {
      instanceType: new ec2.InstanceType("t3.small"),
      desiredCapacity: 1,
      minCapacity: 1,
      maxCapacity: 2,
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
    });
  }
}
