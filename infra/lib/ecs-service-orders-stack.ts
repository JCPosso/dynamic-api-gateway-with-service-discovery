import { Stack, StackProps, aws_ecs as ecs } from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props extends StackProps {
  cluster: ecs.Cluster;
  serviceName: string;
}

export class EcsServiceOrdersStack extends Stack {
  public readonly service: ecs.Ec2Service;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const taskDef = new ecs.Ec2TaskDefinition(this, "OrdersTaskDef");

    taskDef.addContainer("OrdersContainer", {
      image: ecs.ContainerImage.fromAsset("../services/orders"),
      memoryLimitMiB: 256,
      portMappings: [{ containerPort: 3001 }],
    });

    this.service = new ecs.Ec2Service(this, "OrdersService", {
      cluster: props.cluster,
      taskDefinition: taskDef,
      serviceName: props.serviceName,
      desiredCount: 1,
    });
  }
}
