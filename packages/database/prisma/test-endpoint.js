const http = require('http');

const data = JSON.stringify({
  username: 'admin@amdox.com',
  password: 'Admin@123'
});

const loginReq = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const loginData = JSON.parse(body);
    const accessToken = loginData.data.accessToken;
    
    // Now request /hrm/employees
    const empReq = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/hrm/employees',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }, (empRes) => {
      let empBody = '';
      empRes.on('data', chunk => empBody += chunk);
      empRes.on('end', () => {
        console.log("Status:", empRes.statusCode);
        console.log("Body:", empBody);
      });
    });
    empReq.end();
  });
});

loginReq.write(data);
loginReq.end();
