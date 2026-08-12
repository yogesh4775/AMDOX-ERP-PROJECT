const http = require('http');

const loginData = JSON.stringify({
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
    'Content-Length': Buffer.byteLength(loginData)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log("=== LOGIN RESPONSE ===");
    console.log(body);
    const parsed = JSON.parse(body);
    const token = parsed.data ? parsed.data.accessToken : parsed.accessToken;
    
    if (token) {
      // call auth/me
      const meReq = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/auth/me',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, (meRes) => {
        let meBody = '';
        meRes.on('data', chunk => meBody += chunk);
        meRes.on('end', () => {
          console.log("=== ME RESPONSE ===");
          console.log(meBody);
        });
      });
      meReq.end();
    }
  });
});

req.on('error', (e) => {
  console.error("Failed to connect to backend:", e.message);
});

req.write(loginData);
req.end();
