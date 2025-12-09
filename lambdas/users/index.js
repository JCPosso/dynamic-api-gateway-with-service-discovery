const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE = process.env.SERVICE_REGISTRY_TABLE;
const SERVICE_NAME = process.env.SERVICE_NAME || "users";
let registered = false;

async function register() {
  if (registered) return;
  const arn = process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (!TABLE || !arn) return;
  await dynamodb
    .put({
      TableName: TABLE,
      Item: {
        serviceName: SERVICE_NAME,
        functionArn: arn,
        type: "lambda",
        timestamp: Date.now(),
      },
    })
    .promise();
  registered = true;
}

exports.handler = async (event) => {
  await register();

  const path = event.path || event.rawPath || "/";
  const method = (event.httpMethod || event.requestContext?.http?.method || "GET").toUpperCase();

  if (path === "/list" && method === "GET") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users: ["Ana", "Luis", "Carlos"] }),
    };
  }

  return {
    statusCode: 404,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Route not found" }),
  };
};
