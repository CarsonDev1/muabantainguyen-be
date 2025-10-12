import { createServer } from 'http';

const server = createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({message: 'Working!'}));
});

// Bind trực tiếp trên public IP
server.listen(3001, '222.255.119.33', () => {
  console.log('Server listening on 222.255.119.33:3001');
});
