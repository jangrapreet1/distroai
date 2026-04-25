async function test() {
  try {
    const loginResp = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@acmetraders.in', password: 'password123' })
    });
    const loginData = await loginResp.json();
    const token = loginData.data.accessToken;

    const res = await fetch('http://localhost:3001/api/v1/orders', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await res.json();
    console.log("Orders success?", d.success);
  } catch(e) {
    console.error(e.message);
  }
}
test();
