import express from "express";

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
app.get("/orders", (req, res) => {
  res.json(orders);
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

app.listen(PORT, () => {
  console.log(`Orders service on port ${PORT}`);
});
