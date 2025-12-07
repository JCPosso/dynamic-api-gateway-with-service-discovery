const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();
const https = require("https");
const http = require("http");

const TABLE = process.env.SERVICE_REGISTRY_TABLE;

// =====================================================================
// Helper: hacer request sin certificados (ECS interno IPv4)
// =====================================================================
function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const lib = options.port == 443 ? https : http;

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on("error", (err) => reject(err));

    if (body) req.write(body);
    req.end();
  });
}

// =====================================================================
// MAIN HANDLER
// =====================================================================
exports.main = async (event) => {
  console.log("EVENT:", JSON.stringify(event));

  try {
    // -----------------------------------------------------------------
    // 1. Extraer serviceName de la ruta del API Gateway
    //    /users/... → serviceName = "users"
    // -----------------------------------------------------------------
    const pathParts = event.rawPath.split("/").filter(Boolean);

    if (pathParts.length === 0) {
      return {
        statusCode: 400,
        body: "Missing service name",
      };
    }

    const serviceName = pathParts[0];
    const relativePath = "/" + pathParts.slice(1).join("/");

    console.log(`Routing to service: ${serviceName}`);
    console.log(`Relative path: ${relativePath}`);

    // -----------------------------------------------------------------
    // 2. Buscar el servicio en DynamoDB
    // -----------------------------------------------------------------
    const res = await dynamo
      .get({
        TableName: TABLE,
        Key: { serviceName },
      })
      .promise();

    if (!res.Item) {
      return {
        statusCode: 404,
        body: `Service ${serviceName} not found in registry`,
      };
    }

    const { host, port } = res.Item;
    console.log("Resolved host:", host, "port:", port);

    // -----------------------------------------------------------------
    // 3. Preparar options para hacer proxy HTTP interno
    // -----------------------------------------------------------------
    const options = {
      hostname: host,
      port,
      path: relativePath + (event.rawQueryString ? `?${event.rawQueryString}` : ""),
      method: event.requestContext.http.method,
      headers: sanitizeHeaders(event.headers),
    };

    let body = null;
    if (event.body) {
      body = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString()
        : event.body;
    }

    console.log("Proxying with options:", options);

    // -----------------------------------------------------------------
    // 4. Hacer proxy al microservicio ECS
    // -----------------------------------------------------------------
    const response = await httpRequest(options, body);

    // -----------------------------------------------------------------
    // 5. Respuesta
    // -----------------------------------------------------------------
    return {
      statusCode: response.statusCode,
      headers: filterResponseHeaders(response.headers),
      body: response.body,
    };
  } catch (err) {
    console.error("ERROR:", err);

    return {
      statusCode: 502,
      body: JSON.stringify({
        message: "Failed to route request",
        error: err.message,
      }),
    };
  }
};

// =====================================================================
// Helpers
// =====================================================================

// Quitar headers que no pueden reenviarse
function sanitizeHeaders(headers = {}) {
  const blocked = ["host", "x-forwarded-for", "x-forwarded-proto"];
  const clean = {};

  for (const [key, value] of Object.entries(headers)) {
    if (!blocked.includes(key.toLowerCase())) {
      clean[key] = value;
    }
  }
  return clean;
}

// Quitar headers de respuesta no válidos para API Gateway
function filterResponseHeaders(headers = {}) {
  const blocked = ["transfer-encoding", "connection"];
  const clean = {};

  for (const [key, val] of Object.entries(headers)) {
    if (!blocked.includes(key.toLowerCase())) {
      clean[key] = val;
    }
  }
  return clean;
}
