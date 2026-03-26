export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const BRAVE_KEY = process.env.BRAVE_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!BRAVE_KEY) return res.status(500).json({ error: 'Brave API key not configured' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Anthropic API key not configured' });

  const niche = (req.query.niche || '').trim();
  const nicheLabel = niche || 'general viral social media';

  try {
    const braveGet = (q) =>
      fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5&freshness=pd&country=us&search_lang=en&ui_lang=en-US`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': BRAVE_KEY
        }
      }).then(r => r.json()).catch(() => null);

    const now = new Date().toISOString().slice(0, 10);

    // Niche-dynamic queries
    const queries = niche
      ? [
          `viral content formats trending ${niche} ${now}`,
          `best hooks working ${niche} social media ${now}`,
          `trending audio sounds ${niche} reels tiktok ${now}`,
          `${niche} creators going viral what they post ${now}`,
          `${niche} Instagram Reels TikTok algorithm tips ${now}`,
          `${niche} short form video trends ${now}`,
        ]
      : [
          `viral social media content formats trending ${now}`,
          `best hooks for reels and tiktok going viral ${now}`,
          `trending audio sounds reels tiktok ${now}`,
          `social media algorithm changes Instagram TikTok ${now}`,
          `short form video trends what is working ${now}`,
          `viral content creator strategies ${now}`,
        ];

    const results = await Promise.all(queries.map(q => braveGet(q)));

    // Collect raw search results
    const seen = new Set();
    const rawItems = [];
    for (const result of results) {
      if (!result || !result.web || !result.web.results) continue;
      for (const item of result.web.results) {
        const key = item.title?.toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        rawItems.push({
          title: item.title,
          snippet: item.description || '',
          source: item.meta_url?.hostname || new URL(item.url).hostname,
          url: item.url
        });
      }
    }

    if (rawItems.length === 0) {
      return res.status(200).json({ trends: [], niche: nicheLabel, fetched_at: new Date().toISOString() });
    }

    // Use Claude to synthesize raw results into actionable niche-specific trends
    const searchDump = rawItems.slice(0, 20).map((item, i) =>
      `${i + 1}. "${item.title}" (${item.source})\n   ${item.snippet}`
    ).join('\n');

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `You are a social media trend analyst. Analyze these search results about "${nicheLabel}" and extract the most actionable trend signals for a content creator in that niche.

Search results from today (${now}):
${searchDump}

Return ONLY valid JSON array with 5-8 trend objects. Each must have:
- "title": short punchy trend headline (max 12 words) — what's happening right now
- "category": exactly one of: "format" | "hook" | "audio" | "creator_move" | "algorithm"
- "signal": one sentence explaining why this matters and how to use it (actionable)
- "source": the domain name of the most relevant search result that supports this trend
- "url": the URL of that source

Categories:
- "format": viral content formats gaining traction in this niche
- "hook": opening lines, text overlays, or attention-grabbing patterns working now
- "audio": trending sounds, music, or audio formats
- "creator_move": what successful creators in this niche are doing that's getting reach
- "algorithm": platform signals, distribution changes, or ranking factors

Be specific to "${nicheLabel}". Do not be generic. Every trend must be something a creator could act on TODAY.
If the search results don't clearly support a trend, skip it — quality over quantity.`
        }]
      })
    });

    const aiData = await aiRes.json();
    if (aiData.error) {
      // Fallback to raw results if AI fails
      return res.status(200).json({
        trends: rawItems.slice(0, 8).map(item => ({ title: item.title, source: item.source, url: item.url, category: 'format', signal: item.snippet })),
        niche: nicheLabel,
        fetched_at: new Date().toISOString()
      });
    }

    const raw = aiData.content[0].text.trim().replace(/```json|```/g, '').trim();
    let trends;
    try {
      trends = JSON.parse(raw);
      if (!Array.isArray(trends)) trends = [trends];
    } catch {
      // Fallback to raw results
      return res.status(200).json({
        trends: rawItems.slice(0, 8).map(item => ({ title: item.title, source: item.source, url: item.url, category: 'format', signal: item.snippet })),
        niche: nicheLabel,
        fetched_at: new Date().toISOString()
      });
    }

    return res.status(200).json({
      trends: trends.slice(0, 8),
      niche: nicheLabel,
      fetched_at: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch trends', detail: err.message });
  }
}
