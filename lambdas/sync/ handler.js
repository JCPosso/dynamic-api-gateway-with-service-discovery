import {
  ECSClient,
  ListServicesCommand,
  ListTasksCommand,
  DescribeTasksCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";
import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const ecs = new ECSClient({});
const ddb = new DynamoDBClient({});

const TABLE = process.env.SERVICE_REGISTRY_TABLE;
const CLUSTER = process.env.ECS_CLUSTER;
const SERVICES = (process.env.SERVICES || "").split(",");

export const main = async () => {
  console.log("Starting Sync…");
  console.log("Services to sync:", SERVICES);

  for (const svc of SERVICES) {
    try {
      console.log(`Syncing service: ${svc}`);

      // 1. Listar tasks activas del servicio
      const tasksResp = await ecs.send(
        new ListTasksCommand({
          cluster: CLUSTER,
          serviceName: svc,
          desiredStatus: "RUNNING",
        })
      );

      if (tasksResp.taskArns.length === 0) {
        console.log(`No tasks running for ${svc}, skipping`);
        continue;
      }

      // 2. Describir la única task
      const desc = await ecs.send(
        new DescribeTasksCommand({
          cluster: CLUSTER,
          tasks: [tasksResp.taskArns[0]],
        })
      );

      const task = desc.tasks?.[0];
      if (!task) {
        console.log("Task no encontrada");
        continue;
      }

      // Obtener IP y puerto
      const attachments = task.attachments || [];
      const eni = attachments.find((a) => a.type === "ElasticNetworkInterface");

      let ip = null;
      if (eni) {
        const details = Object.fromEntries(
          eni.details.map((d) => [d.name, d.value])
        );
        ip = details.privateIPv4Address;
      }

      // ECS (mode EC2) usa hostPort para exponer containers
      const container = task.containers?.[0];
      const port = container?.networkBindings?.[0]?.hostPort;

      if (!ip || !port) {
        console.log("No se pudo determinar IP/Port:", { ip, port });
        continue;
      }

      const url = `http://${ip}:${port}`;

      console.log(`Registering in DynamoDB: ${svc} → ${url}`);

      // 3. Registrar servicio en DynamoDB
      await ddb.send(
        new PutItemCommand({
          TableName: TABLE,
          Item: {
            serviceName: { S: svc },
            url: { S: url },
            updatedAt: { S: new Date().toISOString() },
          },
        })
      );
    } catch (err) {
      console.error(`Error syncing service ${svc}:`, err);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ synced: SERVICES }),
  };
};
