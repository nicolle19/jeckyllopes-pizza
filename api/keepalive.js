export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  try {
    const response = await fetch(`${url}/rest/v1/pizza_signups?select=count`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    const data = await response.json();
    console.log('[keepalive] pizza_signups count:', JSON.stringify(data));
    return res.status(200).json({ ok: true, result: data });
  } catch (err) {
    console.error('[keepalive] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
