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
    // Nota: API Gateway proxy solo envía 'path', no 'rawPath'
    // -----------------------------------------------------------------
    const requestPath = event.rawPath || event.path || "/";
    const pathParts = requestPath.split("/").filter(Boolean);

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

    // -----------------------------------------------------------------
    // 3. Enrutamiento: si hay functionArn -> invocar Lambda, si hay IP -> HTTP
    // -----------------------------------------------------------------
    if (res.Item.functionArn) {
      const lambdaPayload = {
        path: relativePath,
        rawPath: relativePath,
        httpMethod: event.requestContext.http.method,
        headers: sanitizeHeaders(event.headers),
        body: event.body,
        isBase64Encoded: event.isBase64Encoded,
        queryStringParameters: event.queryStringParameters || {},
      };

      const invokeRes = await new AWS.Lambda()
        .invoke({
          FunctionName: res.Item.functionArn,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify(lambdaPayload),
        })
        .promise();

      const payload = JSON.parse(invokeRes.Payload || "{}");
      return {
        statusCode: payload.statusCode || 502,
        headers: payload.headers || {},
        body: payload.body || "",
      };
    }

    const { ip } = res.Item;
    if (!ip) {
      return {
        statusCode: 503,
        body: `Service ${serviceName} has no IP registered`,
      };
    }

    const port = serviceName === "users" ? 3000 : 3001;
    console.log("Resolved IP:", ip, "port:", port);

    const options = {
      hostname: ip,
      port,
      path: relativePath + (event.rawQueryString || event.queryStringParameters ? `?${event.rawQueryString || new URLSearchParams(event.queryStringParameters || {}).toString()}` : ""),
      method: event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || "GET",
      headers: sanitizeHeaders(event.headers),
    };

    let body = null;
    if (event.body) {
      body = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString()
        : event.body;
    }

    console.log("Proxying with options:", options);

    const response = await httpRequest(options, body);

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
