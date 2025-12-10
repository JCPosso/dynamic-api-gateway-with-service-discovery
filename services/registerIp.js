const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const os = require("os");
const http = require("http");

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

async function getInstanceId() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "169.254.169.254",
      path: "/latest/meta-data/instance-id",
      timeout: 2000,
    };

    const req = http.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(data.trim());
        } else {
          // Fallback: generar ID único basado en hostname e IP
          const fallbackId = `${os.hostname()}-${Date.now()}`;
          console.warn(`Failed to get EC2 instance ID, using fallback: ${fallbackId}`);
          resolve(fallbackId);
        }
      });
    });

    req.on("error", (err) => {
      const fallbackId = `${os.hostname()}-${Date.now()}`;
      console.warn(`Error getting instance ID: ${err.message}, using fallback: ${fallbackId}`);
      resolve(fallbackId);
    });

    req.on("timeout", () => {
      req.destroy();
      const fallbackId = `${os.hostname()}-${Date.now()}`;
      console.warn(`Timeout getting instance ID, using fallback: ${fallbackId}`);
      resolve(fallbackId);
    });
  });
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
      `[registerIp] Getting instance ID and IP for service: ${serviceName}`
    );
    
    const instanceId = await getInstanceId();
    const ip = await getPublicIp();
    const port = parseInt(process.env.PORT || "3000");

    console.log(
      `[registerIp] Instance: ${instanceId}, IP: ${ip}, Port: ${port}`
    );

    const client = new DynamoDBClient({
      region: process.env.AWS_DEFAULT_REGION || "us-east-1",
    });
    const dynamodb = DynamoDBDocumentClient.from(client);

    const params = {
      TableName: tableName,
      Item: {
        serviceName,           // Partition key
        instanceId,            // Sort key (soporte para múltiples instancias)
        host: ip,              // IP del servicio
        port: port,            // Puerto del servicio
        weight: 1,             // Peso para weighted round robin (futuro)
        timestamp: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 86400, // 24 horas
      },
    };

    console.log(
      `[registerIp] Putting item to DynamoDB:`,
      JSON.stringify(params, null, 2)
    );
    await dynamodb.send(new PutCommand(params));
    console.log(
      `✓ Service '${serviceName}' (${instanceId}) successfully registered with IP: ${ip}:${port}`
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
