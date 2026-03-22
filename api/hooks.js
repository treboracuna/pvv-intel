export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  // GET — fetch all hooks ordered by viral score
  if (req.method === 'GET') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/pvv_hooks?select=*&order=viral_score.desc.nullslast,created_at.desc`, { headers });
    const d = await r.json();
    return res.status(r.status).json(d);
  }

  // POST
  if (req.method === 'POST') {
    const { action } = req.body;

    if (action === 'save') {
      const { hook, platform, format, viral_score, title } = req.body;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pvv_hooks`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ hook, platform, format, viral_score, title, created_at: new Date().toISOString() })
      });
      const d = await r.json();
      return res.status(r.status).json(d);
    }

    if (action === 'delete') {
      const { id } = req.body;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pvv_hooks?id=eq.${id}`, {
        method: 'DELETE',
        headers
      });
      return res.status(r.status).json({ deleted: true });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
