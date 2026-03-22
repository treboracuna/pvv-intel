export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  // POST — save a video entry
  if (req.method === 'POST') {
    const { action } = req.body;

    // Create table if needed via RPC — we use insert and let Supabase handle it
    if (action === 'save') {
      const { title, platform, format, hook, posted_date, views, likes, comments, shares, watch_time_pct, reach, led_to_dm, led_to_booking, notes } = req.body;

      const payload = {
        title, platform, format, hook, posted_date,
        views: parseInt(views) || 0,
        likes: parseInt(likes) || 0,
        comments: parseInt(comments) || 0,
        shares: parseInt(shares) || 0,
        watch_time_pct: parseFloat(watch_time_pct) || 0,
        reach: parseInt(reach) || 0,
        led_to_dm: led_to_dm === true || led_to_dm === 'true',
        led_to_booking: led_to_booking === true || led_to_booking === 'true',
        notes: notes || '',
        created_at: new Date().toISOString()
      };

      const r = await fetch(`${SUPABASE_URL}/rest/v1/pvv_videos`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      return res.status(r.status).json(d);
    }

    // Analyze patterns
    if (action === 'analyze') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pvv_videos?select=*&order=views.desc`, {
        headers
      });
      const videos = await r.json();
      if (!Array.isArray(videos) || videos.length === 0) {
        return res.status(200).json({ insight: 'No data yet. Log at least 3 videos to see patterns.' });
      }

      // Build analysis prompt
      const summary = videos.map(v =>
        `Title: ${v.title} | Platform: ${v.platform} | Format: ${v.format} | Hook: ${v.hook} | Views: ${v.views} | Likes: ${v.likes} | Shares: ${v.shares} | Watch Time: ${v.watch_time_pct}% | Led to DM: ${v.led_to_dm} | Led to Booking: ${v.led_to_booking}`
      ).join('\n');

      const prompt = `You are analyzing content performance data for Prestige Valley Visuals (PVV), a real estate video production company in the Rio Grande Valley, Texas.

Here is their complete video performance history:
${summary}

Analyze this data and return ONLY valid JSON:
{
  "top_performers": [{"title": "...", "why": "..."}],
  "winning_formats": ["format1", "format2"],
  "winning_hooks": ["hook pattern 1", "hook pattern 2"],
  "best_platform": "platform name",
  "best_posting_pattern": "what day/time/frequency works",
  "eliminate": ["what is not working and why"],
  "secret_sauce": "2-3 sentences describing the specific repeatable formula that drives the most views AND bookings for PVV based on this data",
  "next_3_videos": [
    {"title": "...", "format": "...", "hook": "...", "why": "based on your data this will perform because..."}
  ]
}`;

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const aiData = await aiRes.json();
      const raw = aiData.content[0].text.trim().replace(/```json|```/g, '').trim();
      return res.status(200).json({ analysis: JSON.parse(raw), total_videos: videos.length });
    }
  }

  // GET — fetch all videos
  if (req.method === 'GET') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/pvv_videos?select=*&order=created_at.desc`, {
      headers
    });
    const d = await r.json();
    return res.status(r.status).json(d);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
