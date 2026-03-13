async function run() {
  const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@distroai.com', password: 'password123' })
  });
  const { data: { accessToken } } = await loginRes.json();
  
  const res = await fetch('http://localhost:3001/api/v1/inventory/warehouses', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  console.log('Warehouses response:', await res.text());
}
run();
