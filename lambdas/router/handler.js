const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const https = require("https");
const http = require("http");

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

const TABLE = process.env.SERVICE_REGISTRY_TABLE;

// =====================================================================
// LOAD BALANCER STATE (persiste entre invocaciones warm)
// =====================================================================
const loadBalancerState = {
  roundRobinCounters: {}, // { "users": 0, "orders": 0 }
  activeConnections: {},  // { "i-abc123": 2, "i-def456": 1 }
};

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
// OBTENER TODAS LAS INSTANCIAS DE UN SERVICIO
// =====================================================================
async function getAllInstances(serviceName) {
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "serviceName = :serviceName",
    ExpressionAttributeValues: {
      ":serviceName": serviceName,
    },
  }));

  if (!result.Items || result.Items.length === 0) {
    throw new Error(`Service ${serviceName} not found in registry`);
  }

  console.log(`Found ${result.Items.length} instance(s) for ${serviceName}`);

  // Retornar array de instancias
  return result.Items.map(item => ({
    instanceId: item.instanceId,
    host: item.host || item.ip, // Soportar ambos nombres
    port: item.port || 3000,
    weight: item.weight || 1,
    metadata: item.metadata || {},
  }));
}

// =====================================================================
// ROUND ROBIN: Seleccionar instancia
// =====================================================================
function selectInstanceRoundRobin(serviceName, instances) {
  // Inicializar contador si no existe
  if (!loadBalancerState.roundRobinCounters[serviceName]) {
    loadBalancerState.roundRobinCounters[serviceName] = 0;
  }

  // Seleccionar instancia
  const counter = loadBalancerState.roundRobinCounters[serviceName];
  const selectedInstance = instances[counter % instances.length];

  // Incrementar contador
  loadBalancerState.roundRobinCounters[serviceName]++;

  console.log(`[Round Robin] Service: ${serviceName}, Selected: ${selectedInstance.instanceId} (${selectedInstance.host}:${selectedInstance.port}), Counter: ${counter}`);

  return selectedInstance;
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
    // 2. Obtener TODAS las instancias del servicio (para Load Balancing)
    // -----------------------------------------------------------------
    const instances = await getAllInstances(serviceName);

    // -----------------------------------------------------------------
    // 3. Seleccionar instancia usando Round Robin
    // -----------------------------------------------------------------
    const selectedInstance = selectInstanceRoundRobin(serviceName, instances);

    const { host, port, instanceId } = selectedInstance;
    console.log(`Selected instance: ${instanceId} at ${host}:${port}`);

    // -----------------------------------------------------------------
    // 4. Construir request al servicio seleccionado
    // -----------------------------------------------------------------
    const options = {
      hostname: host,
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

    // Track active connection
    const connectionKey = instanceId;
    loadBalancerState.activeConnections[connectionKey] = 
      (loadBalancerState.activeConnections[connectionKey] || 0) + 1;

    const startTime = Date.now();

    // -----------------------------------------------------------------
    // 5. Hacer request HTTP al servicio
    // -----------------------------------------------------------------
    const response = await httpRequest(options, body);

    const latency = Date.now() - startTime;

    // Release connection
    loadBalancerState.activeConnections[connectionKey]--;

    console.log(`Response from ${instanceId}: ${response.statusCode} (${latency}ms)`);

    // -----------------------------------------------------------------
    // 6. Retornar respuesta con metadata de load balancing
    // -----------------------------------------------------------------
    let responseBody = response.body;
    
    // Si es JSON, agregar metadata de load balancer
    try {
      const jsonBody = JSON.parse(response.body);
      jsonBody._loadBalancer = {
        selectedInstance: instanceId,
        algorithm: "round-robin",
        latency: `${latency}ms`,
        totalInstances: instances.length,
        host: `${host}:${port}`,
      };
      responseBody = JSON.stringify(jsonBody);
    } catch (e) {
      // No es JSON, dejar body original
    }

    return {
      statusCode: response.statusCode,
      headers: {
        ...filterResponseHeaders(response.headers),
        "X-Selected-Instance": instanceId,
        "X-Load-Balancer": "lambda-round-robin",
        "X-Total-Instances": instances.length.toString(),
      },
      body: responseBody,
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
