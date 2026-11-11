// Premade suits for the Shop page and the lookbook tags. Each one is a builder design, so "Make it mine"
// opens it in the builder and the price is worked out the same way as a design (base + customizations).
// Shared by the browser (globalThis.PeacesSuits) and the tests.
(function (root) {
  var SUITS = [
    { id: "coral-classic", name: "The Coral Classic", blurb: "Coral bralette top + seamless bottom.",
      design: { topStyle: "underwire", bottomStyle: "seamless", topColor: "coral", bottomColor: "coral", addons: [] } },
    { id: "blue-classic", name: "The Blue Classic", blurb: "Blue bralette top + seamless bottom.",
      design: { topStyle: "underwire", bottomStyle: "seamless", topColor: "teal", bottomColor: "teal", addons: [] } },
    { id: "blue-wrap", name: "The Blue Wrap", blurb: "Blue bralette with extended ties around the ribs.",
      design: { topStyle: "underwire", bottomStyle: "seamless", topColor: "teal", bottomColor: "teal",
        addons: [{ id: "extTies", variant: "match", cfg: { style: "band" } }] } },
    { id: "blue-lace-wrap", name: "The Blue Lace Wrap", blurb: "Blue bralette with white lace and extended ties.",
      design: { topStyle: "underwire", bottomStyle: "seamless", topColor: "teal", bottomColor: "teal",
        addons: [{ id: "laceTrim", variant: "white", cfg: { bottom: "front" } }, { id: "extTies", variant: "match", cfg: { style: "band" } }] } },
    { id: "mint-wrap", name: "The Mint Wrap", blurb: "Mint triangle set with extended ties.",
      design: { topStyle: "triangle", bottomStyle: "triangle", topColor: "green", bottomColor: "green",
        addons: [{ id: "extTies", variant: "match", cfg: { style: "plain" } }] } },
    { id: "mint-lace", name: "The Mint Lace", blurb: "Mint triangle set with white lace.",
      design: { topStyle: "triangle", bottomStyle: "triangle", topColor: "green", bottomColor: "green",
        addons: [{ id: "laceTrim", variant: "white", cfg: { bottom: "front" } }] } },
    { id: "cheetah-heart", name: "The Cheetah Heart", blurb: "Cheetah triangle set, heart connector, ties wrapped under the bust.",
      design: { topStyle: "triangle", bottomStyle: "triangle", topColor: "cheetah", bottomColor: "cheetah",
        addons: [{ id: "connectors", variant: "c-heartring", cfg: { top: "mid", bottom: "no" } }, { id: "extTies", variant: "match", cfg: { style: "wrap" } }] } },
  ];
  // Lookbook tags: which suits are in each photo, and where (percent of the photo's width / height).
  var LOOK_TAGS = {
    "look-01": [["coral-classic", 40, 64]],
    "look-02": [["blue-wrap", 52, 45]],
    "look-04": [["blue-lace-wrap", 42, 37], ["coral-classic", 50, 37]],
    "look-05": [["cheetah-heart", 28, 63], ["mint-wrap", 52, 62]],
    "look-06": [["blue-classic", 54, 58]],
    "look-07": [["mint-wrap", 26, 58], ["blue-lace-wrap", 38, 60], ["mint-lace", 53, 55]],
    "look-08": [["mint-lace", 58, 56]],
    "look-09": [["cheetah-heart", 41, 54]],
    "look-10": [["cheetah-heart", 35, 32]],
  };
  root.PeacesSuits = { SUITS: SUITS, LOOK_TAGS: LOOK_TAGS,
    byId: function (id) { for (var i = 0; i < SUITS.length; i++) if (SUITS[i].id === id) return SUITS[i]; return null; } };
})(typeof globalThis !== "undefined" ? globalThis : this);
