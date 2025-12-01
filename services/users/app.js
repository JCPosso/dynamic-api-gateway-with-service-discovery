const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'users' });
});

app.post('/register', (req, res) => {
  console.log('register request', req.body);
  res.json({ registered: true, received: req.body });
});

app.listen(port, () => {
  console.log(`Users service listening on ${port}`);
});
