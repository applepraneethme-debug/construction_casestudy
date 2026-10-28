const http = require('http');

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runLiveVerification() {
  console.log('=== LIVE WORKFLOW VERIFICATION ON PORT 5001 ===\n');

  // 1. Health endpoint
  const health = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/health',
    method: 'GET'
  });
  console.log(`1. /api/health -> Status: ${health.status}, Response:`, health.body);

  // 2. Unauthenticated access enforcement across all protected endpoints
  const protectedEndpoints = [
    '/api/inventory',
    '/api/movements',
    '/api/requisitions',
    '/api/consumption',
    '/api/wastage',
    '/api/users',
    '/api/projects',
    '/api/sites'
  ];

  console.log('\n2. Unauthenticated Access Denial:');
  for (const ep of protectedEndpoints) {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: ep,
      method: 'GET'
    });
    console.log(`   ${ep.padEnd(20)} -> Status ${res.status} [${res.status === 401 ? 'PASS: Denied' : 'FAIL'}]`);
  }

  // 3. Invalid credentials test
  console.log('\n3. Authentication & Brute-Force / Invalid Credential Handling:');
  const badLogin = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'nonexistent@construction.com', password: 'WrongPassword99!' });
  console.log(`   Invalid Login       -> Status ${badLogin.status} (${badLogin.body.message}) [${badLogin.status === 401 ? 'PASS' : 'FAIL'}]`);

  console.log('\n=== LIVE API VERIFICATION COMPLETE ===\n');
}

runLiveVerification().catch(console.error);
