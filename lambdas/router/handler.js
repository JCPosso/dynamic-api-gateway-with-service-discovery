import {
  DynamoDBClient,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import fetch from "node-fetch";

const ddb = new DynamoDBClient({});
const TABLE = process.env.SERVICE_REGISTRY_TABLE;

// Helper para crear respuesta HTTP válida para API Gateway
function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export const main = async (event) => {
  try {
    console.log("Incoming event:", JSON.stringify(event));

    const rawPath = event.path;
    if (!rawPath.startsWith("/svc/")) {
      return response(400, { error: "Ruta inválida. Use /svc/<service>/..." });
    }

    const parts = rawPath.split("/");
    const serviceName = parts[2];

    if (!serviceName) {
      return response(400, { error: "No se especificó el servicio" });
    }

    // Obtener registro del ServiceRegistry
    const result = await ddb.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: { serviceName: { S: serviceName } },
      })
    );

    if (!result.Item) {
      return response(404, {
        error: `Servicio '${serviceName}' no encontrado en Service Registry`,
      });
    }

    const baseUrl = result.Item.url.S;
    const forwardPath = parts.slice(3).join("/") || "";
    const targetUrl = `${baseUrl}/${forwardPath}`;

    console.log("Forwarding request to:", targetUrl);

    const fetchOptions = {
      method: event.httpMethod,
      headers: event.headers || {},
      body: event.body || null,
    };

    const res = await fetch(targetUrl, fetchOptions);
    const text = await res.text();

    return {
      statusCode: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: text,
    };
  } catch (err) {
    console.error("Router Error:", err);
    return response(500, { error: "Router interno falló", detail: err.message });
  }
};
