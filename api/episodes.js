// Latest full episodes from the Off The Clock YouTube channel's public feed.
// Shorts are skipped: only titles with "Ep. NN" count. Cached at the edge for 3 hours, so the
// site picks up a new episode within a few hours with nobody editing anything.
const CHANNEL = 'UCGMNq--H05H_Lfa4K4J1b9Q';

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// "Off The Clock with Shane Singh (CEO of Cash Converters Digital) Ep. 93" → name + line
// "Legal Mistakes …: Expert Insights from Adv. Itumeleng Moeletsi Ep. 92" → name + line
const shape = (raw) => {
  const title = decode(raw).replace(/\s*\|?\s*Ep\.?\s*\d+\s*$/i, '').trim();
  let m = title.match(/^Off The Clock with (.+?)\s*\((.+)\)\s*$/i);
  if (m) return { name: m[1], line: m[2] };
  m = title.match(/^Off The Clock with (.+)$/i);
  if (m) return { name: m[1], line: '' };
  m = title.match(/^(.+?):\s*.*?\bfrom\s+(.+)$/i);
  if (m) return { name: m[2], line: m[1] };
  m = title.match(/^(.+?):\s*(.+)$/);
  if (m) return { name: m[1], line: m[2] };
  return { name: title, line: '' };
};

module.exports = async (req, res) => {
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`, { headers: { 'user-agent': 'off-the-clock-site' } });
    if (!r.ok) throw new Error('feed ' + r.status);
    const xml = await r.text();
    const episodes = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      .map(([, e]) => {
        const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
        const n = (title.match(/Ep\.?\s*(\d+)/i) || [])[1];
        const id = (e.match(/<yt:videoId>([\w-]+)<\/yt:videoId>/) || [])[1];
        const date = ((e.match(/<published>([^<]+)<\/published>/) || [])[1] || '').slice(0, 10);
        return n && id ? { n: +n, id, date, title: decode(title), ...shape(title) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3);
    if (!episodes.length) throw new Error('no episodes');
    res.setHeader('Cache-Control', 'public, s-maxage=10800, stale-while-revalidate=86400');
    res.status(200).json({ episodes });
  } catch (err) {
    // the page keeps its built-in list when this fails
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(502).json({ episodes: [], error: String(err.message || err) });
  }
};
