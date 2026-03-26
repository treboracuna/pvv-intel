// ============================================================
// DATA FETCHER — swap braveSearch for apifyFetch when ready
// ============================================================

async function braveSearch(url, platform) {
  const BRAVE_KEY = process.env.BRAVE_API_KEY;
  if (!BRAVE_KEY) throw new Error('BRAVE_API_KEY not set');

  const query = `site:${new URL(url).hostname} ${url}`;
  const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(url)}&count=5`, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_KEY
    }
  });
  const data = await r.json();
  const result = (data.web?.results || [])[0] || {};

  // Parse whatever we can from the snippet
  const snippet = result.description || result.title || '';
  const views = extractNumber(snippet, ['views', 'plays', 'watch']) || 0;
  const likes = extractNumber(snippet, ['likes', 'hearts']) || 0;
  const comments = extractNumber(snippet, ['comments', 'replies']) || 0;
  const shares = extractNumber(snippet, ['shares', 'reposts', 'retweets']) || 0;

  return {
    title: result.title || '',
    snippet,
    views, likes, comments, shares,
    source: 'brave',
    raw_url: url
  };
}

// APIFY STUB — uncomment and fill in when switching
// async function apifyFetch(url, platform) {
//   const APIFY_KEY = process.env.APIFY_API_KEY;
//   const actorId = platform === 'TikTok' ? 'clockworks~tiktok-scraper' : 'apify~instagram-scraper';
//   const r = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_KEY}`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ directUrls: [url], resultsType: 'posts', maxPostsPerQuery: 1 })
//   });
//   const [item] = await r.json();
//   return {
//     title: item.text || item.caption || '',
//     views: item.playCount || item.videoPlayCount || 0,
//     likes: item.likesCount || item.diggCount || 0,
//     comments: item.commentsCount || 0,
//     shares: item.sharesCount || item.repostCount || 0,
//     watch_time_pct: item.avgWatchTime || 0,
//     source: 'apify',
//     raw_url: url
//   };
// }

function extractNumber(text, keywords) {
  for (const kw of keywords) {
    const match = text.match(new RegExp(`([\d,.]+)\s*k?m?\s*${kw}`, 'i')) ||
                  text.match(new RegExp(`${kw}[:\s]+([\d,.]+)k?m?`, 'i'));
    if (match) {
      let n = parseFloat(match[1].replace(/,/g, ''));
      if (/k/i.test(match[0])) n *= 1000;
      if (/m/i.test(match[0])) n *= 1000000;
      return Math.round(n);
    }
  }
  return null;
}
// ============================================================

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

    // FETCH URL — pulls public data from a reel/post URL
    // TO SWITCH TO APIFY: replace the braveSearch() function below with apifyFetch()
    if (action === 'fetch_url') {
      const { url, platform } = req.body;
      if (!url) return res.status(400).json({ error: 'No URL provided' });

      try {
        const data = await braveSearch(url, platform);
        return res.status(200).json(data);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // ANALYZE IMAGE — reads analytics screenshot and extracts stats
    if (action === 'analyze_image') {
      const { image_base64, image_type } = req.body;
      if (!image_base64) return res.status(400).json({ error: 'No image provided' });

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image_type || 'image/jpeg',
                  data: image_base64
                }
              },
              {
                type: 'text',
                text: `You are analyzing a social media analytics screenshot (Instagram, TikTok, or similar).
Extract all visible metrics and return ONLY valid JSON with no markdown:
{
  "views": <total views number or null>,
  "views_followers": <follower views number or null>,
  "views_nonfollowers": <non-follower views number or null>,
  "src_stories": <stories source % or null>,
  "src_reels": <reels tab source % or null>,
  "src_profile": <profile source % or null>,
  "src_feed": <feed source % or null>,
  "src_explore": <explore source % or null>,
  "src_search": <search source % or null>,
  "skip_rate": <skip rate % or null>,
  "typical_skip_rate": <typical/average skip rate % or null>,
  "total_watch_min": <total watch time in minutes or null>,
  "avg_watch_sec": <average watch time in seconds or null>,
  "likes": <number or null>,
  "reposts": <number or null>,
  "shares": <number or null>,
  "saves": <number or null>,
  "comments": <number or null>,
  "follows_gained": <follows from this content or null>,
  "top_country": "<country name or null>",
  "top_age_range": "<age range like 25-34 or null>",
  "gender_male_pct": <male % or null>,
  "platform": "<Instagram|TikTok|YouTube|LinkedIn|unknown>",
  "notes": "<any other useful info visible like date range, content type, or notable metrics>",
  "raw_text": "<all numbers and labels you can read from the image>"
}
If a metric is not visible, use null. Convert K/M to full numbers (1.2K = 1200). For time values, convert to the requested unit (minutes or seconds).`
              }
            ]
          }]
        })
      });

      const aiData = await aiRes.json();
      if (aiData.error) return res.status(500).json({ error: aiData.error.message });
      const raw = aiData.content[0].text.trim().replace(/\`\`\`json|\`\`\`/g, '').trim();
      try {
        const parsed = JSON.parse(raw);
        return res.status(200).json(parsed);
      } catch(e) {
        return res.status(200).json({ raw_text: raw, error: 'Could not parse structured data' });
      }
    }

    if (action === 'save') {
      const b = req.body;

      const payload = {
        title: b.title, platform: b.platform, format: b.format, hook: b.hook, posted_date: b.posted_date,
        views: parseInt(b.views) || 0,
        views_followers: parseInt(b.views_followers) || 0,
        views_nonfollowers: parseInt(b.views_nonfollowers) || 0,
        src_stories: parseFloat(b.src_stories) || 0,
        src_reels: parseFloat(b.src_reels) || 0,
        src_profile: parseFloat(b.src_profile) || 0,
        src_feed: parseFloat(b.src_feed) || 0,
        src_explore: parseFloat(b.src_explore) || 0,
        src_search: parseFloat(b.src_search) || 0,
        skip_rate: parseFloat(b.skip_rate) || 0,
        typical_skip_rate: parseFloat(b.typical_skip_rate) || 0,
        total_watch_min: parseFloat(b.total_watch_min) || 0,
        avg_watch_sec: parseFloat(b.avg_watch_sec) || 0,
        likes: parseInt(b.likes) || 0,
        reposts: parseInt(b.reposts) || 0,
        shares: parseInt(b.shares) || 0,
        saves: parseInt(b.saves) || 0,
        comments: parseInt(b.comments) || 0,
        follows_gained: parseInt(b.follows_gained) || 0,
        led_to_dm: b.led_to_dm === true || b.led_to_dm === 'true',
        led_to_booking: b.led_to_booking === true || b.led_to_booking === 'true',
        top_country: b.top_country || '',
        top_age_range: b.top_age_range || '',
        gender_male_pct: parseFloat(b.gender_male_pct) || 0,
        notes: b.notes || '',
        reel_url: b.reel_url || '',
        account: b.account || 'PVV',
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
      const { account: analyzeAccount } = req.body;
      const acctFilter = analyzeAccount && analyzeAccount !== 'ALL' ? `&account=eq.${encodeURIComponent(analyzeAccount)}` : '';
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pvv_videos?select=*&order=views.desc${acctFilter}`, {
        headers
      });
      const videos = await r.json();
      if (!Array.isArray(videos) || videos.length === 0) {
        return res.status(200).json({ insight: 'No data yet. Log at least 3 videos to see patterns.' });
      }

      // Build analysis prompt
      const summary = videos.map(v =>
        `Title: ${v.title} | Platform: ${v.platform} | Format: ${v.format} | Hook: ${v.hook} | Views: ${v.views} (Followers: ${v.views_followers||0}, Non-followers: ${v.views_nonfollowers||0}) | Sources: Stories ${v.src_stories||0}%, Reels ${v.src_reels||0}%, Profile ${v.src_profile||0}%, Feed ${v.src_feed||0}%, Explore ${v.src_explore||0}%, Search ${v.src_search||0}% | Skip Rate: ${v.skip_rate||0}% (Typical: ${v.typical_skip_rate||0}%) | Watch: ${v.total_watch_min||0}min total, ${v.avg_watch_sec||0}s avg | Likes: ${v.likes} | Reposts: ${v.reposts||0} | Shares: ${v.shares} | Saves: ${v.saves||0} | Comments: ${v.comments} | Follows: ${v.follows_gained||0} | DM: ${v.led_to_dm} | Booking: ${v.led_to_booking} | Audience: ${v.top_country||'—'}, ${v.top_age_range||'—'}, ${v.gender_male_pct||0}% male`
      ).join('\n');

      const acctName = req.body.account || 'PVV';
      const acctDescriptions = { 'PVV': 'Prestige Valley Visuals — real estate video production company in RGV, Texas', 'Texaswide Insurance': 'Texaswide Insurance — insurance services content', 'Exclusiva': 'Exclusiva Homes / Alexandra Properties — commercial real estate development' };
      const acctDesc = acctDescriptions[acctName] || acctName;
      const prompt = `You are analyzing content performance data for ${acctDesc}.

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
    const account = req.query?.account || req.headers['x-account'] || 'PVV';
    const accountFilter = account === 'ALL' ? '' : `&account=eq.${encodeURIComponent(account)}`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/pvv_videos?select=*&order=created_at.desc${accountFilter}`, {
      headers
    });
    const d = await r.json();
    return res.status(r.status).json(d);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
