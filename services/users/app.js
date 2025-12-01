const express = require("express");
const app = express();

app.use(express.json());

app.get("/list", (req, res) => {
  res.json({ users: ["Ana", "Luis", "Carlos"] });
});

app.listen(3000, () => console.log("Users service running on 3000"));
