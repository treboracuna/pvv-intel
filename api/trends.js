export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const BRAVE_KEY = process.env.BRAVE_API_KEY;
  if (!BRAVE_KEY) return res.status(500).json({ error: 'Brave API key not configured' });

  try {
    const braveGet = (q) =>
      fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=3&freshness=pd`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': BRAVE_KEY
        }
      }).then(r => r.json()).catch(() => null);

    const now = new Date().toISOString().slice(0, 10);

    const queries = [
      `real estate video production trends ${now}`,
      `viral real estate content ideas trending ${now}`,
      `RGV South Texas real estate market news ${now}`,
      `real estate social media strategy trending ${now}`,
      `luxury real estate videography trends 2025`,
      `real estate content creator tips trending ${now}`,
      `Rio Grande Valley real estate news ${now}`,
      `short form video real estate marketing trends ${now}`
    ];

    const results = await Promise.all(queries.map(q => braveGet(q)));

    const seen = new Set();
    const trends = [];

    for (const result of results) {
      if (!result || !result.web || !result.web.results) continue;
      for (const item of result.web.results) {
        const key = item.title?.toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        trends.push({
          title: item.title,
          source: item.meta_url?.hostname || new URL(item.url).hostname,
          url: item.url
        });
      }
    }

    // Return 8 unique trends max
    return res.status(200).json({
      trends: trends.slice(0, 8),
      fetched_at: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch trends', detail: err.message });
  }
}
