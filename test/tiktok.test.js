import test from "node:test";
import assert from "node:assert/strict";
import { parseEmbedPage } from "../lib/tiktok.js";

const state = { source: { data: { "/embed/@peacesswim": { videoList: [
  { id: "7701188593296919839", desc: "The Peaces Process", playCount: 762, privateItem: false, coverUrl: "https://p19-common-sign.tiktokcdn-us.com/a.jpg" },
  { id: "7695538782266854686", desc: "Hidden", playCount: 5, privateItem: true, coverUrl: "https://p16-common-sign.tiktokcdn-us.com/b.jpg" },
  { id: "7694003450383781151", desc: "Odd cover", playCount: 1076, privateItem: false, coverUrl: "https://evil.example.com/c.jpg" },
  { id: "not-a-number", desc: "Bad", playCount: 1 },
] } } } };
const html = '<html><script id="__FRONTITY_CONNECT_STATE__" type="application/json">' + JSON.stringify(state) + "</script></html>";

test("tiktok: reads the latest public videos from TikTok's profile embed page", () => {
  const v = parseEmbedPage(html);
  assert.equal(v.length, 2);
  assert.deepEqual(v[0], { id: "7701188593296919839", desc: "The Peaces Process", views: 762, cover: "https://p19-common-sign.tiktokcdn-us.com/a.jpg" });
  assert.equal(v[1].cover, null, "only TikTok's own image hosts");
});
test("tiktok: a changed or broken page gives an empty list, not an error", () => {
  assert.deepEqual(parseEmbedPage("<html></html>"), []);
  assert.deepEqual(parseEmbedPage('<script id="__FRONTITY_CONNECT_STATE__">{oops</script>'), []);
});
