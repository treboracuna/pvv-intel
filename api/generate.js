export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { model, max_tokens, messages, platform, niche, location, fetchHashtags } = req.body;
    const loc = location || 'Texas';
    const plat = platform || 'Instagram Reels';
    const now = new Date().toISOString().slice(0, 10);

    let trendContext = '';
    let audioContext = '';
    let radarContext = '';
    let algoContext = '';
    let timeContext = '';

    if (process.env.BRAVE_API_KEY) {
      try {
        const braveGet = (q, freshness = 'pd', count = 4) =>
          fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${count}&freshness=${freshness}`, {
            headers: {
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip',
              'X-Subscription-Token': process.env.BRAVE_API_KEY
            }
          }).then(r => r.json()).catch(() => null);

        const snippets = (results) => results
          .filter(Boolean)
          .flatMap(r => (r.web?.results || []).map(x => `${x.title}: ${x.description || ''}`).filter(Boolean));

        const [
          trendResults, audioResults,
          radarResults, algoResults, timeResults
        ] = await Promise.all([
          // Existing trend queries
          Promise.all([
            braveGet(`${niche} viral ${plat} content ${now}`),
            braveGet(`real estate video trending ${loc} ${now}`),
            braveGet(`${plat} trending real estate hooks ${now}`),
            braveGet(`most viewed real estate content ${plat} 2025`),
            braveGet(`viral real estate video format ${plat} this week`)
          ]),
          // Audio queries
          Promise.all([
            braveGet(`trending audio ${plat} real estate luxury 2025`, 'pw'),
            braveGet(`viral songs ${plat} reels property tour 2025`, 'pw'),
            braveGet(`popular background music real estate video ${plat} trending now`, 'pw')
          ]),
          // Niche trend radar — gaining momentum BEFORE going viral
          Promise.all([
            braveGet(`emerging content trends real estate social media ${now}`, 'pw', 5),
            braveGet(`${niche} upcoming trends ${plat} gaining momentum 2025`, 'pw', 5),
            braveGet(`real estate content ideas gaining traction ${plat} ${now}`, 'pd', 5),
            braveGet(`next big real estate video trend ${plat} 2025`, 'pw', 5)
          ]),
          // Platform algorithm tracker
          Promise.all([
            braveGet(`${plat} algorithm update ${now} what content is being pushed`, 'pw', 5),
            braveGet(`${plat} algorithm 2025 what types of videos get more reach`, 'pw', 5),
            braveGet(`how ${plat} algorithm works 2025 real estate creators`, 'pm', 5),
            braveGet(`${plat} ranking signals 2025 what gets pushed to explore`, 'pm', 5)
          ]),
          // Best time to post
          Promise.all([
            braveGet(`best time to post on ${plat} ${loc} audience 2025`, 'pm', 5),
            braveGet(`best time to post real estate content ${plat} 2025`, 'pm', 5),
            braveGet(`when to post on ${plat} for maximum reach real estate ${now}`, 'pw', 5)
          ])
        ]);

        const trendSnippets = snippets(trendResults).slice(0, 12).join('\n');
        const audioSnippets = snippets(audioResults).slice(0, 8).join('\n');
        const radarSnippets = snippets(radarResults).slice(0, 12).join('\n');
        const algoSnippets = snippets(algoResults).slice(0, 12).join('\n');
        const timeSnippets = snippets(timeResults).slice(0, 8).join('\n');

        if (trendSnippets) trendContext = `\n\nLIVE TREND DATA (${now}):\n${trendSnippets}`;
        if (audioSnippets) audioContext = `\n\nLIVE AUDIO TRENDS (${now}):\n${audioSnippets}`;
        if (radarSnippets) radarContext = `\n\nNICHE TREND RADAR — GAINING MOMENTUM NOW:\n${radarSnippets}`;
        if (algoSnippets) algoContext = `\n\nPLATFORM ALGORITHM INTEL (${plat}):\n${algoSnippets}`;
        if (timeSnippets) timeContext = `\n\nBEST TIME TO POST DATA:\n${timeSnippets}`;

      } catch (e) {}
    }

    let hashtagContext = '';
    if (fetchHashtags && process.env.BRAVE_API_KEY) {
      try {
        const braveGet = (q, freshness = 'pw', count = 5) =>
          fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${count}&freshness=${freshness}`, {
            headers: {
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip',
              'X-Subscription-Token': process.env.BRAVE_API_KEY
            }
          }).then(r => r.json()).catch(() => null);

        const hashtagResults = await Promise.all([
          braveGet(`trending hashtags ${niche || 'business'} ${plat} ${now}`, 'pw', 5),
          braveGet(`best hashtags for ${niche || 'business'} ${plat} 2026 high reach`, 'pw', 5),
          braveGet(`${plat} hashtag strategy ${niche || 'business'} viral reach ${now}`, 'pw', 5),
          braveGet(`top performing hashtags ${niche || 'business'} content creators ${plat}`, 'pm', 5),
          braveGet(`niche hashtags ${niche || 'business'} ${loc} ${plat} under 500k posts`, 'pm', 5)
        ]);

        const hashtagSnippets = hashtagResults
          .filter(Boolean)
          .flatMap(r => (r.web?.results || []).map(x => `${x.title}: ${x.description || ''}`).filter(Boolean))
          .slice(0, 15)
          .join('\n');

        if (hashtagSnippets) {
          hashtagContext = `\n\nLIVE TRENDING HASHTAG DATA (${now}):\n${hashtagSnippets}`;
        }
      } catch (e) {}
    }

    const fullContext = [trendContext, audioContext, radarContext, algoContext, timeContext, hashtagContext].join('')
      ? [trendContext, audioContext, radarContext, algoContext, timeContext].join('') + `

CRITICAL INSTRUCTIONS — use ALL of this live data:
1. For each idea recommend 2-3 trending audio tracks with artist + song title
2. Add a "momentum_signal" field to each idea — is this topic RISING, PEAKED, or EMERGING based on radar data
3. Add "best_post_time" to each idea — specific day + time window based on the time data
4. In patterns, add "algorithm_insight" — what ${plat} is currently pushing based on algo data
5. In patterns, add "radar_topics" — array of 3 topics gaining momentum right now before going viral`
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
      _audio_data_used: !!audioContext,
      _radar_used: !!radarContext,
      _algo_used: !!algoContext,
      _time_used: !!timeContext,
      _hashtag_data_used: !!hashtagContext
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
