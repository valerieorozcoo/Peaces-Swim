// Shared placement and option rules for the preview and server-priced orders.
// Locations are named from the wearer's perspective, never the viewer's.
export const DETAIL_OPTIONS = {
  beads: [["turquoise","Turquoise"],["lightpink","Light pink"],["darkpink","Dark pink"],["lightgreen","Light green"],["coral","Coral"],["pink","Pink"],["lightblue","Light blue"],["purpleblue","Light purple"],["lightturq","Light turquoise"]],
  bows: [["pink","Light pink"],["white","White"]], roses: [["pink","Pink"]], buttons: [["pearl","Pearl"]],
  charmsB: [["c-shell","Shell"],["c-heart","Heart"],["c-star","Star"]],
  charmsP: [["c-bead1","Bead charm 1"],["c-bead2","Bead charm 2"]],
  extTies: [["pink","Pink"],["green","Green"],["turq","Turquoise"],["coral","Coral"]],
  laceTrim: [["white","White"],["pink","Pink"],["coral","Coral"],["turq","Turquoise"],["green","Green"]],
  laceOver: [["white","White"],["black","Black"],["pink","Pink"],["lav","Lavender"]],
  ruffles: [["pink","Pink"],["green","Green"],["turq","Turquoise"],["coral","Coral"]],
  initials: [["silver","Silver"],["gold","Gold"]], connectors: [["gold","Gold"]],
};
export const LOCATIONS = {
  "top-straps": { label:"Both top straps", part:"top" },
  "top-center": { label:"Top · center front", part:"top" },
  "top-ties": { label:"Top · extended ties", part:"top" },
  "top-wrap-cross": { label:"Top · crossed wrap", part:"top" },
  "top-wrap-center": { label:"Top · center wrap", part:"top" },
  "top-neckline": { label:"Top · neckline", part:"top" },
  "top-underbust": { label:"Top · lower cup edges", part:"top" },
  "top-cups": { label:"Top · both cups", part:"top" },
  "top-left": { label:"Top · wearer’s left cup", part:"top" },
  "top-right": { label:"Top · wearer’s right cup", part:"top" },
  "top-panels": { label:"Top · both panels", part:"top" },
  "bottom-center": { label:"Bottom · center front", part:"bottom" },
  "bottom-waist": { label:"Bottom · front waistband", part:"bottom" },
  "bottom-hips": { label:"Bottom · both hips", part:"bottom" },
  "bottom-panel": { label:"Bottom · front panel", part:"bottom" },
};
export function locationsFor(id, d) {
  const triangle = d.topStyle === "triangle", triangleBottom = d.bottomStyle === "triangle";
  switch (id) {
    case "extTies": return triangle ? ["top-wrap-cross","top-wrap-center","top-straps"] : ["top-wrap-center","top-straps"];
    case "beads": return ["top-straps","top-center","top-ties"];
    case "charmsB": case "charmsP": return (triangle ? [] : ["top-center"]).concat(["top-ties","bottom-hips"]);
    case "initials": return (triangle ? [] : ["top-cups","top-left","top-right"]).concat(["bottom-center"]);
    case "connectors": return (triangle ? ["top-center"] : []).concat(triangleBottom ? ["bottom-hips"] : []);
    case "ruffles": return (triangle ? ["top-neckline"] : []).concat(triangleBottom ? ["bottom-waist"] : []);
    case "laceTrim": return ["top-neckline","top-underbust","bottom-waist","bottom-hips"];
    case "laceOver": return ["top-panels","bottom-panel"];
    case "bows": case "roses": case "buttons": return ["top-center","bottom-center"];
    default: return [];
  }
}
// Defaults also migrate designs saved before location choices existed.
export function defaultLocations(id, d) {
  const all = locationsFor(id, d);
  if (id === "extTies") return ["top-straps"];
  if (id === "beads") return ["top-straps","top-center"];
  if (id === "laceTrim") return ["top-neckline","bottom-waist"];
  if (id === "initials") return ["bottom-center"];
  if (id === "charmsB" || id === "charmsP") return all.filter(x => x !== "top-ties");
  return all;
}
export function optionFor(id, value) {
  const options = DETAIL_OPTIONS[id];
  if (!options) throw new Error("Unknown add-on");
  if (id === "initials" && value === "clear") value = "silver";
  if (value === undefined || value === null || value === "") return options[0];
  const v = String(value).toLowerCase();
  const option = options.find(o => o[0].toLowerCase() === v || o[1].toLowerCase() === v);
  if (!option) throw new Error("Choose an available finish for this add-on");
  return option;
}
export function validatePlacements(addons, d) {
  for (const a of addons) {
    const all = locationsFor(a.id, d);
    if (!all.length) throw new Error("This add-on isn't available on these styles");
    if (!Array.isArray(a.placements) || !a.placements.length || a.placements.length > all.length ||
        a.placements.some(x => !all.includes(x)) || new Set(a.placements).size !== a.placements.length)
      throw new Error("Choose a valid placement for this add-on");
    if (a.id === "extTies" && a.placements.length !== 1) throw new Error("Choose one extended-tie route");
    if (a.id === "initials" && a.placements.includes("top-cups") && a.placements.some(x => x === "top-left" || x === "top-right"))
      throw new Error("Choose both cups or individual cups, not both");
    if (a.id === "laceTrim" && a.placements.includes("bottom-waist") && a.placements.includes("bottom-hips"))
      throw new Error("Choose a front waistband or a full hip-to-hip trim");
    if (a.placements.includes("top-ties") && !addons.some(x => x.id === "extTies"))
      throw new Error("Add extended ties before placing beads or charms on them");
    if (a.id === "extTies" && d.topStyle === "triangle" && a.placements[0].startsWith("top-wrap") &&
        !addons.some(x => x.id === "connectors" && x.placements.includes("top-center")))
      throw new Error("Triangle wrap ties need a center connector");
  }
  const center = addons.filter(a => ["bows","roses","buttons","charmsB","charmsP","connectors"].includes(a.id) && a.placements.includes("top-center"));
  if (center.length > 1) throw new Error("Choose one detail for the top center attachment");
}
