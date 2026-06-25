const http = require('http');

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/jobs',
  method: 'GET'
}, res => {
  console.log('STATUS:', res.statusCode);
  res.on('data', d => process.stdout.write(d));
});
req.on('error', e => console.error(e));
req.end();
