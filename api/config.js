export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    supabase_url: process.env.SUPABASE_URL,
    supabase_key: process.env.SUPABASE_ANON_KEY
  });
}
