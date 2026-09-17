import http from 'node:http';

// Probe the actual listener without bypassing the application's Host boundary.
// Do not include the access password or make an external/AI request.
let host;
try { host = new URL(process.env.APIFIT_PUBLIC_ORIGIN).host; } catch { process.exit(1); }
const request = http.get({ hostname: '127.0.0.1', port: process.env.APIFIT_PORT || process.env.PORT || 8080,
  path: '/api/health', headers: { Host: host }, timeout: 3000 }, response => {
  let body = '';
  response.on('data', chunk => { body += chunk; if (body.length > 1024) request.destroy(); });
  response.on('end', () => {
    try { process.exit(response.statusCode === 200 && JSON.parse(body).status === 'ok' ? 0 : 1); }
    catch { process.exit(1); }
  });
});
request.on('timeout', () => request.destroy());
request.on('error', () => process.exit(1));
