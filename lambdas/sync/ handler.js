const AWS = require("aws-sdk");

const ecs = new AWS.ECS();
const dynamo = new AWS.DynamoDB.DocumentClient();

const TABLE = process.env.SERVICE_REGISTRY_TABLE;

exports.main = async (event) => {
  console.log("EVENT:", JSON.stringify(event, null, 2));

  // Event viene de Custom Resource o de cron
  const serviceName = event.ResourceProperties?.serviceName || process.env.SERVICE_NAME;

  if (!serviceName) {
    throw new Error("serviceName no definido");
  }

  // Se requiere ECS Cluster para leer tasks
  const clusterName =
    event.ResourceProperties?.clusterName || process.env.ECS_CLUSTER;

  if (!clusterName) {
    throw new Error("clusterName no definido");
  }

  // Puerto del servicio (ej: 3000)
  const port = parseInt(
    event.ResourceProperties?.port || process.env.PORT || "3000"
  );

  // -----------------------------------------------------------------------
  // PASO 1: Obtener ECS Tasks
  // -----------------------------------------------------------------------

  const tasksArns = await ecs
    .listTasks({
      cluster: clusterName,
      serviceName,
      desiredStatus: "RUNNING",
    })
    .promise();

  if (tasksArns.taskArns.length === 0) {
    console.log(`❗ No tasks running para ${serviceName}`);
    return sendResponse(event, "SUCCESS");
  }

  const taskData = await ecs
    .describeTasks({
      cluster: clusterName,
      tasks: tasksArns.taskArns,
    })
    .promise();

  const task = taskData.tasks[0];

  // -----------------------------------------------------------------------
  // PASO 2: Resolver ENI → IP privada
  // -----------------------------------------------------------------------

  const attachment = task.attachments.find((a) => a.type === "ElasticNetworkInterface");

  const eniId = attachment.details.find((d) => d.name === "networkInterfaceId")
    .value;

  const ec2 = new AWS.EC2();
  const eniData = await ec2
    .describeNetworkInterfaces({
      NetworkInterfaceIds: [eniId],
    })
    .promise();

  const privateIp = eniData.NetworkInterfaces[0].PrivateIpAddress;

  console.log("IP privada encontrada:", privateIp);

  // -----------------------------------------------------------------------
  // PASO 3: Escribir/Actualizar en DynamoDB
  // -----------------------------------------------------------------------

  const item = {
    serviceName,
    host: privateIp,
    port,
    updatedAt: Date.now(),
  };

  await dynamo
    .put({
      TableName: TABLE,
      Item: item,
    })
    .promise();

  console.log(`Registro actualizado para ${serviceName}:`, item);

  return sendResponse(event, "SUCCESS");
};

// -----------------------------------------------------------------------
// Custom Resource helper
// -----------------------------------------------------------------------
function sendResponse(event, status) {
  if (event?.ResponseURL) {
    const https = require("https");
    const url = require("url");

    const responseBody = JSON.stringify({
      Status: status,
      Reason: "See CloudWatch",
      PhysicalResourceId: event.LogicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    });

    const parsedUrl = url.parse(event.ResponseURL);

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: "PUT",
      headers: {
        "Content-Type": "",
        "Content-Length": responseBody.length,
      },
    };

    const request = https.request(options, () => {});
    request.write(responseBody);
    request.end();
  }

  return { status };
}
