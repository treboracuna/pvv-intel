export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model, max_tokens, messages, platform, niche, location } = req.body;
    const loc = location || 'Texas';
    const plat = platform || 'Instagram Reels';

    let trendContext = '';
    let audioContext = '';

    if (process.env.BRAVE_API_KEY) {
      try {
        const now = new Date().toISOString().slice(0, 10);

        const trendQueries = [
          `${niche} viral ${plat} content ${now}`,
          `real estate video trending ${loc} ${now}`,
          `${plat} trending real estate hooks ${now}`,
          `most viewed real estate content creator ${plat} 2025`,
          `viral real estate video format ${plat} this week`
        ];

        const audioQueries = [
          `trending audio ${plat} real estate luxury 2025`,
          `viral songs ${plat} reels property tour 2025`,
          `popular background music real estate video ${plat} trending now`
        ];

        const [trendResults, audioResults] = await Promise.all([
          Promise.all(trendQueries.map(q =>
            fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=4&freshness=pd`, {
              headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': process.env.BRAVE_API_KEY
              }
            }).then(r => r.json()).catch(() => null)
          )),
          Promise.all(audioQueries.map(q =>
            fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=4&freshness=pw`, {
              headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': process.env.BRAVE_API_KEY
              }
            }).then(r => r.json()).catch(() => null)
          ))
        ]);

        const trendSnippets = trendResults
          .filter(Boolean)
          .flatMap(r => (r.web?.results || []).map(x => `${x.title}: ${x.description || ''}`).filter(Boolean))
          .slice(0, 12)
          .join('\n');

        const audioSnippets = audioResults
          .filter(Boolean)
          .flatMap(r => (r.web?.results || []).map(x => `${x.title}: ${x.description || ''}`).filter(Boolean))
          .slice(0, 8)
          .join('\n');

        if (trendSnippets) {
          trendContext = `\n\nLIVE TREND DATA (fetched ${now}):\n${trendSnippets}`;
        }
        if (audioSnippets) {
          audioContext = `\n\nLIVE AUDIO TREND DATA (fetched ${now}):\n${audioSnippets}`;
        }
      } catch (e) {}
    }

    const fullContext = trendContext + audioContext
      ? trendContext + audioContext + `\n\nCRITICAL: Use this live data. For each content idea, recommend 2-3 specific trending audio tracks that match the video mood. Include artist name and song title. Base audio picks on what is actually trending right now on ${plat} for this content style.`
      : '';

    const updatedMessages = messages.map((msg, i) => {
      if (i === messages.length - 1 && msg.role === 'user' && fullContext) {
        return { ...msg, content: msg.content + fullContext };
      }
      return msg;
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model, max_tokens, messages: updatedMessages })
    });

    const data = await response.json();
    return res.status(response.status).json({
      ...data,
      _trend_data_used: !!trendContext,
      _audio_data_used: !!audioContext
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
