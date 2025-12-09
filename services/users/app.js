const express = require("express");
const { registerIp } = require("./registerIp.js");
const app = express();

app.use(express.json());

app.get("/list", (req, res) => {
  res.json({ users: ["Ana", "Luis", "Carlos"] });
});

const PORT = 3000;
const server = app.listen(PORT, async () => {
  console.log(`[app.js] Users service started on port ${PORT}`);
  try {
    console.log(`[app.js] Starting service registration...`);
    await registerIp("users", process.env.DYNAMODB_TABLE);
    console.log(`[app.js] Service registration completed`);
  } catch (error) {
    console.error(`[app.js] Failed to register service:`, error);
  }
});

server.on("error", (err) => {
  console.error(`[app.js] Server error:`, err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error(`[app.js] Uncaught exception:`, err);
  process.exit(1);
});
