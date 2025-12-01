import {
  ECSClient,
  ListTasksCommand,
  DescribeTasksCommand,
} from "@aws-sdk/client-ecs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ecs = new ECSClient({});
const db = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(db);

type ServiceEntry = { name: string; port?: number };

export const handler = async (): Promise<{ status: string }> => {
  console.log("Syncing ECS services to DynamoDB...");

  const clusterName = process.env.CLUSTER;
  const table = process.env.SERVICE_TABLE;
  const servicesRaw = process.env.SERVICES;

  if (!clusterName || !table || !servicesRaw) {
    throw new Error("Missing required env vars: CLUSTER, SERVICE_TABLE, SERVICES");
  }

  let services: ServiceEntry[];
  try {
    services = JSON.parse(servicesRaw) as ServiceEntry[];
  } catch (err) {
    throw new Error("Invalid SERVICES JSON: " + String(err));
  }

  for (const svc of services) {
    const listResp = await ecs.send(
      new ListTasksCommand({ cluster: clusterName, serviceName: svc.name })
    );

    if ((listResp.taskArns?.length ?? 0) === 0) {
      console.log(`No tasks for service ${svc.name}`);
      continue;
    }

    const describeResp = await ecs.send(
      new DescribeTasksCommand({ cluster: clusterName, tasks: listResp.taskArns })
    );

    const tasks = describeResp.tasks ?? [];

    for (const task of tasks) {
      const details = task.attachments?.flatMap((a) => a.details ?? []) ?? [];
      const eni = details.find((d) => d.name === "privateIPv4Address");
      if (!eni || !eni.value) continue;

      const host = eni.value;
      const port = svc.port ?? 80;
      console.log(`Sync: ${svc.name} → ${host}:${port}`);

      await ddb.send(
        new PutCommand({
          TableName: table,
          Item: {
            serviceName: svc.name,
            host,
            port,
            taskArn: task.taskArn,
          },
        })
      );
    }
  }

  return { status: "ok" };
};
