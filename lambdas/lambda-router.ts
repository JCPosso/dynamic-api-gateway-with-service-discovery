import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({});
const TABLE_NAME = process.env.SERVICE_REGISTRY_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET!; // para MVP

/**
 * Utilidades
 */
function jsonResponse(code: number, body: object): APIGatewayProxyResultV2 {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function validateJWT(authHeader?: string): Promise<any> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.substring(7); // remove "Bearer "

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    throw new Error("Invalid JWT token");
  }
}

async function resolveService(serviceName: string): Promise<string> {
  const cmd = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: { serviceName: { S: serviceName } }
  });

  const res = await dynamo.send(cmd);
  if (!res.Item || !res.Item.url?.S) {
    throw new Error(`Service "${serviceName}" not found in registry`);
  }

  return res.Item.url.S;
}

/**
 * Handler principal
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    // 1. Validar JWT
    await validateJWT(event.headers?.authorization);

    // 2. Extraer servicio de la ruta: /svc/{serviceName}/...
    const rawPath = event.rawPath;
    const match = rawPath.match(/^\/svc\/([^/]+)(.*)$/);

    if (!match) {
      return jsonResponse(400, { error: "Invalid router path" });
    }

    const serviceName = match[1];
    const servicePath = match[2] || "/";

    // 3. Resolver servicio en DynamoDB
    const baseUrl = await resolveService(serviceName);

    const targetUrl = `${baseUrl}${servicePath}`;
    console.log("→ Routing to:", targetUrl);

    // 4. Forward al microservicio (fetch nativo)
    const method = event.requestContext.http.method;
    const body = event.body ? event.body : undefined;

    const forwarded = await fetch(targetUrl, {
      method,
      headers: event.headers as any,
      body: ["GET", "HEAD"].includes(method) ? undefined : body
    });

    const responseBody = await forwarded.text();

    return {
      statusCode: forwarded.status,
      headers: Object.fromEntries(forwarded.headers.entries()),
      body: responseBody
    };

  } catch (err: any) {
    console.error("Router error", err);
    return jsonResponse(500, { error: err.message });
  }
};
