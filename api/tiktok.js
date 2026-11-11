import { latestVideos } from "../lib/tiktok.js";
// GET /api/tiktok → the latest @peacesswim videos for the home page carousel.
// Cached at the edge for an hour so we only ask TikTok a few times a day.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const videos = await latestVideos();
    res.setHeader("Cache-Control", videos.length ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store");
    return res.status(200).json({ videos });
  } catch (e) {
    console.error("[tiktok]", e.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ videos: [] });
  }
}
