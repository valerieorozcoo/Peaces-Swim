// Latest @peacesswim TikToks, read from TikTok's public profile embed page
// (the same data TikTok's own profile embed shows). No login or keys needed.
export const TIKTOK_USER = "peacesswim";

export function parseEmbedPage(html, user = TIKTOK_USER) {
  const m = /<script[^>]*id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/.exec(html || "");
  if (!m) return [];
  let state;
  try { state = JSON.parse(m[1]); } catch { return []; }
  const data = (state.source && state.source.data) || {};
  const page = data["/embed/@" + user] || Object.values(data).find((d) => d && Array.isArray(d.videoList)) || {};
  return (page.videoList || [])
    .filter((v) => v && /^\d{6,25}$/.test(String(v.id)) && !v.privateItem)
    .map((v) => ({
      id: String(v.id),
      desc: String(v.desc || "").slice(0, 160),
      views: Number(v.playCount) || 0,
      cover: /^https:\/\/[a-z0-9.-]+\.(tiktokcdn(-us)?\.com|ttwstatic\.com)\//.test(v.coverUrl || v.originCoverUrl || "") ? (v.coverUrl || v.originCoverUrl) : null,
    }))
    .slice(0, 15);
}

export async function latestVideos(fetchImpl = fetch) {
  const r = await fetchImpl("https://www.tiktok.com/embed/@" + TIKTOK_USER, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!r.ok) throw new Error("tiktok " + r.status);
  return parseEmbedPage(await r.text());
}
