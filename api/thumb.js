// YouTube thumbnail proxy. Some networks, school/office filters and ad blockers block i.ytimg.com,
// which left the live episode and shorts tiles empty. Serving the image from our own domain avoids that,
// and the edge cache means YouTube is hit once per video.
const VARIANTS = new Set(['hqdefault', 'mqdefault', 'oardefault', 'maxresdefault', 'sddefault']);

module.exports = async (req, res) => {
  const { id = '', v = 'hqdefault' } = req.query || {};
  if (!/^[\w-]{11}$/.test(id) || !VARIANTS.has(v)) { res.statusCode = 400; res.end('bad request'); return; }
  try {
    const r = await fetch(`https://i.ytimg.com/vi/${id}/${v}.jpg`);
    if (!r.ok) { res.statusCode = r.status === 404 ? 404 : 502; res.setHeader('Cache-Control', 'public, s-maxage=300'); res.end('not found'); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400');
    res.end(buf);
  } catch (e) {
    res.statusCode = 502;
    res.end('upstream error');
  }
};
