const express = require("express");
const { registerIp } = require("../registerIp.js");
const app = express();

app.use(express.json());

app.get("/list", (req, res) => {
  res.json({ users: ["Ana", "Luis", "Carlos"] });
});

app.listen(3000, async () => {
  console.log("Users service running on 3000");
  await registerIp("users", process.env.DYNAMODB_TABLE);
});
