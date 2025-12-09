const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE = process.env.SERVICE_REGISTRY_TABLE;
const SERVICE_NAME = process.env.SERVICE_NAME || "orders";
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

let orders = [
  { id: 1, item: "Monitor", qty: 2 },
  { id: 2, item: "Teclado", qty: 1 },
];

exports.handler = async (event) => {
  await register();

  const method = (event.httpMethod || event.requestContext?.http?.method || "GET").toUpperCase();
  const path = event.path || event.rawPath || "/";
  const body = event.body ? JSON.parse(event.body) : undefined;

  if (path === "/" && method === "GET") {
    return ok({ message: "Orders service running" });
  }

  if (path === "/orders" && method === "GET") {
    return ok(orders);
  }

  if (path.startsWith("/orders/") && method === "GET") {
    const id = parseInt(path.split("/")[2], 10);
    const order = orders.find((o) => o.id === id);
    if (!order) return notFound("Order not found");
    return ok(order);
  }

  if (path === "/orders" && method === "POST") {
    const { item, qty } = body || {};
    const newOrder = { id: orders.length + 1, item, qty };
    orders.push(newOrder);
    return created(newOrder);
  }

  if (path.startsWith("/orders/") && method === "DELETE") {
    const id = parseInt(path.split("/")[2], 10);
    orders = orders.filter((o) => o.id !== id);
    return ok({ message: "Deleted" });
  }

  return notFound("Route not found");
};

function ok(payload) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function created(payload) {
  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function notFound(msg) {
  return {
    statusCode: 404,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg }),
  };
}
