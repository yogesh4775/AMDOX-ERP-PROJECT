const http = require('http');

const data = JSON.stringify({
  username: 'admin@amdox.com',
  password: 'Admin@123'
});

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    console.log("Headers:", res.headers);
    console.log("Body:", body);
  });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
