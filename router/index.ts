import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import fetch from "node-fetch";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.SERVICE_TABLE || "ServiceRegistry";

export const handler = async (event: any) => {
  try {
    console.log("Incoming event:", JSON.stringify(event));

    const rawPath = event.rawPath || event.path || "/";
    const [_, serviceName, ...rest] = rawPath.split("/"); 
    const servicePath = "/" + rest.join("/");

    if (!serviceName) {
      return response(400, { error: "Missing service name in path." });
    }

    const dbResult = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { serviceName }
      })
    );

    if (!dbResult.Item) {
      return response(404, { error: `Service '${serviceName}' not found` });
    }

    const endpoint = dbResult.Item.endpoint;
    console.log(`Routing to ${endpoint}${servicePath}`);

    const url = new URL(endpoint + servicePath);

    const queryParams = event.queryStringParameters || {};
    Object.keys(queryParams).forEach(key =>
      url.searchParams.append(key, queryParams[key])
    );

    const method = event.requestContext?.http?.method || event.httpMethod || "GET";
    const headers = event.headers || {};

    let body = event.body;
    if (event.isBase64Encoded) {
      body = Buffer.from(event.body, "base64");
    }

    const result = await fetch(url.toString(), {
      method,
      headers,
      body: ["GET", "HEAD"].includes(method) ? undefined : body
    });

    const text = await result.text();

    return {
      statusCode: result.status,
      headers: { "Content-Type": result.headers.get("content-type") || "application/json" },
      body: text
    };

  } catch (err: any) {
    console.error("Router error:", err);

    return response(500, {
      error: "Router failed",
      details: err.message
    });
  }
};

function response(status: number, body: any) {
  return {
    statusCode: status,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  };
}