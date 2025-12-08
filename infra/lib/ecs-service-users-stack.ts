import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecs from "aws-cdk-lib/aws-ecs";

interface Props extends StackProps {
  cluster: ecs.Cluster;
  serviceName: string;
}

export class EcsServiceUsersStack extends Stack {
  public readonly service: ecs.Ec2Service;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { cluster, serviceName } = props;

    const taskDef = new ecs.Ec2TaskDefinition(this, "TaskDef");

    taskDef.addContainer("AppContainer", {
      image: ecs.ContainerImage.fromAsset("./services/users"),
      memoryLimitMiB: 256,
      portMappings: [{ containerPort: 3000 }],
      logging: new ecs.AwsLogDriver({ streamPrefix: serviceName }),
    });

    this.service = new ecs.Ec2Service(this, "UsersService", {
      cluster,
      taskDefinition: taskDef,
      serviceName: serviceName,
      desiredCount: 1,
    });
  }
}
