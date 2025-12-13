const express = require("express");
const { registerIp } = require("./registerIp.js");

const app = express();
app.use(express.json());

// Simple demo database
let orders = [
  { id: 1, item: "Monitor", qty: 2 },
  { id: 2, item: "Teclado", qty: 1 }
];

// Health check
app.get("/", (req, res) => {
  res.send("Orders service running");
});

// GET ALL
app.get("/list", (req, res) => {
  res.json({ orders: orders });
});

// GET BY ID
app.get("/orders/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const order = orders.find((o) => o.id === id);

  if (!order) return res.status(404).send("Order not found");
  res.json(order);
});

// CREATE
app.post("/orders", (req, res) => {
  const { item, qty } = req.body;
  const newOrder = {
    id: orders.length + 1,
    item,
    qty
  };

  orders.push(newOrder);
  res.status(201).json(newOrder);
});

// DELETE
app.delete("/orders/:id", (req, res) => {
  const id = parseInt(req.params.id);
  orders = orders.filter((o) => o.id !== id);
  res.send("Deleted");
});

// SERVICE PORT (important)
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, async () => {
  console.log(`[index.js] Orders service started on port ${PORT}`);
  try {
    console.log(`[index.js] Starting service registration...`);
    await registerIp("orders", process.env.DYNAMODB_TABLE);
    console.log(`[index.js] Service registration completed`);
  } catch (error) {
    console.error(`[index.js] Failed to register service:`, error);
  }
});

server.on("error", (err) => {
  console.error(`[index.js] Server error:`, err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error(`[index.js] Uncaught exception:`, err);
  process.exit(1);
});
