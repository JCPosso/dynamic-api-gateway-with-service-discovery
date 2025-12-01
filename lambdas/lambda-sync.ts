import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { ECSClient, ListTasksCommand, DescribeTasksCommand } from '@aws-sdk/client-ecs';

const dynamo = new DynamoDBClient({});
const ecs = new ECSClient({});

const TABLE = process.env.SERVICE_REGISTRY_TABLE!;
const CLUSTER = process.env.ECS_CLUSTER!;
const SERVICE_NAME = process.env.ECS_SERVICE_NAME!;

export const handler = async () => {
  console.log("Syncing ECS services…");

  const list = await ecs.send(
    new ListTasksCommand({
      cluster: CLUSTER,
      serviceName: SERVICE_NAME
    })
  );

  if (!list.taskArns || list.taskArns.length === 0) {
    console.warn("No tasks found");
    return;
  }

  const desc = await ecs.send(
    new DescribeTasksCommand({
      cluster: CLUSTER,
      tasks: list.taskArns
    })
  );

  const task = desc.tasks?.[0];
  if (!task?.containers || task.containers.length === 0) {
    console.warn("No containers reported");
    return;
  }

  const container = task.containers[0];
  const network = task.attachments?.[0]?.details || [];

  const privateIp = network.find(n => n.name === "privateIPv4Address")?.value;

  if (!privateIp || !container.networkBindings || container.networkBindings.length === 0) {
    console.warn("No network binding");
    return;
  }

  const port = container.networkBindings[0].hostPort;

  const url = `http://${privateIp}:${port}`;

  console.log("Registering URL:", url);

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        serviceName: { S: SERVICE_NAME },
        url: { S: url },
        updatedAt: { S: new Date().toISOString() }
      }
    })
  );

  console.log("Service registry updated!");
};
