const AWS = require("aws-sdk");
const https = require("https");
const os = require("os");

async function getPublicIp() {
  return new Promise((resolve) => {
    https.get("https://checkip.amazonaws.com/", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data.trim()));
    }).on("error", () => {
      // Fallback a IP privada si no se puede obtener IP pública
      const ip = Object.values(os.networkInterfaces())
        .flat()
        .find((iface) => iface.family === "IPv4" && !iface.internal)?.address;
      resolve(ip || "unknown");
    });
  });
}

async function registerIp(serviceName, tableName) {
  try {
    if (!tableName) {
      console.warn("DYNAMODB_TABLE env var not set, skipping registration");
      return;
    }

    const dynamodb = new AWS.DynamoDB.DocumentClient({
      region: process.env.AWS_DEFAULT_REGION || "us-east-1",
    });

    const ip = await getPublicIp();
    console.log(`Obtained IP for registration: ${ip}`);

    const params = {
      TableName: tableName,
      Item: {
        serviceName,
        ip,
        timestamp: Date.now(),
        port: process.env.PORT || 3000,
      },
    };

    await dynamodb.put(params).promise();
    console.log(`✓ Service '${serviceName}' registered in DynamoDB with IP: ${ip}`);
  } catch (err) {
    console.error(`✗ Error registering '${serviceName}' in DynamoDB:`, err.message);
  }
}

module.exports = { registerIp };
