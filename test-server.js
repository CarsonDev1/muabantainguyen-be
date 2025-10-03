import express from 'express';
const app = express();
const port = 4000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Test server listening on 0.0.0.0:${port}`);
});
