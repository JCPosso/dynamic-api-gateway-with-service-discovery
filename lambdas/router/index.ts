import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.SERVICE_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY || "";
const USE_RS256 = process.env.JWT_RS256 === "true";

export const handler = async (event: any) => {
  try {
    console.log("Incoming event:", JSON.stringify(event));

    const auth = event.headers?.authorization || event.headers?.Authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return response(401, { error: "Missing Bearer token" });
    }

    const token = auth.replace("Bearer ", "");

    try {
      if (USE_RS256) {
        jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ["RS256"] });
      } else {
        jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
      }
    } catch (err) {
      console.error("JWT verification failed:", err);
      return response(403, { error: "Invalid or expired token" });
    }

    const rawPath = event.rawPath || event.path || "/";
    const [_, serviceName, ...rest] = rawPath.split("/");
    const servicePath = "/" + rest.join("/");

    if (!serviceName) {
      return response(400, { error: "Missing service name in path." });
    }

    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { serviceName }
      })
    );

    if (!result.Item) {
      return response(404, { error: `Service '${serviceName}' not registered` });
    }

    const endpoint = result.Item.endpoint;
    const url = new URL(endpoint + servicePath);

    const qp = event.queryStringParameters || {};
    Object.keys(qp).forEach(k => url.searchParams.append(k, qp[k]));

    const method = event.requestContext?.http?.method || event.httpMethod || "GET";
    const headers = event.headers || {};

    let body = event.body;
    if (event.isBase64Encoded) body = Buffer.from(event.body, "base64");


    const responseService = await fetch(url.toString(), {
      method,
      headers,
      body: ["GET", "HEAD"].includes(method) ? undefined : body
    });

    const text = await responseService.text();

    return {
      statusCode: responseService.status,
      headers: { 
        "Content-Type": responseService.headers.get("content-type") || "application/json" 
      },
      body: text
    };
  } catch (err: any) {
    console.error("Router error:", err);
    return response(500, { error: "router failed", details: err.message });
  }
};

function response(status: number, body: any) {
  return {
    statusCode: status,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  };
}
