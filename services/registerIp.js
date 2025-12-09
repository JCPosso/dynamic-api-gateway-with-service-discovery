const AWS = require("aws-sdk");
const os = require("os");

async function registerIp(serviceName, tableName) {
  const dynamodb = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_DEFAULT_REGION || "us-east-1" });
  const ip = Object.values(os.networkInterfaces())
    .flat()
    .find((iface) => iface.family === "IPv4" && !iface.internal)?.address;

  if (!ip) {
    console.log("No se pudo obtener la IP");
    return;
  }

  const params = {
    TableName: tableName,
    Item: {
      serviceName,
      ip,
      timestamp: Date.now(),
    },
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`IP registrada en DynamoDB: ${ip}`);
  } catch (err) {
    console.error("Error registrando IP en DynamoDB", err);
  }
}

module.exports = { registerIp };
