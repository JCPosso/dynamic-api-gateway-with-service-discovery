const AWS = require("aws-sdk");
const os = require("os");

async function getPublicIp() {
  try {
    // Intentar obtener IP pública desde checkip.amazonaws.com
    const response = await fetch("https://checkip.amazonaws.com/", {
      timeout: 5000,
    });
    const ip = await response.text();
    return ip.trim();
  } catch (error) {
    console.warn("Failed to get public IP, using private IP:", error.message);
    // Fallback a IP privada
    const ip = Object.values(os.networkInterfaces())
      .flat()
      .find((iface) => iface.family === "IPv4" && !iface.internal)?.address;
    return ip || "unknown";
  }
}

async function registerIp(serviceName, tableName) {
  console.log(
    `[registerIp] Starting registration for ${serviceName}, tableName: ${tableName}`
  );

  try {
    if (!tableName) {
      console.warn(
        `[registerIp] DYNAMODB_TABLE env var not set, skipping registration`
      );
      return;
    }

    console.log(
      `[registerIp] Getting public IP for service: ${serviceName}`
    );
    const ip = await getPublicIp();
    console.log(
      `[registerIp] Obtained IP: ${ip} for service: ${serviceName}`
    );

    const dynamodb = new AWS.DynamoDB.DocumentClient({
      region: process.env.AWS_DEFAULT_REGION || "us-east-1",
    });

    const params = {
      TableName: tableName,
      Item: {
        serviceName,
        ip,
        timestamp: Date.now(),
        port: process.env.PORT || 3000,
      },
    };

    console.log(
      `[registerIp] Putting item to DynamoDB:`,
      JSON.stringify(params, null, 2)
    );
    await dynamodb.put(params).promise();
    console.log(
      `✓ Service '${serviceName}' successfully registered in DynamoDB with IP: ${ip}:${process.env.PORT}`
    );
  } catch (err) {
    console.error(
      `✗ Error registering '${serviceName}' in DynamoDB:`,
      err.message,
      err.stack
    );
  }
}

module.exports = { registerIp };
