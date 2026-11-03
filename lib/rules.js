// Peaces Swim add-on rules: what each customization is, where it can go on each shape,
// the limits, and the price. ONE file used by both the builder page (<script src="lib/rules.js">)
// and checkout pricing on the server (import "./rules.js"), so they can never disagree.
// Plain script on purpose: no import/export, it just sets globalThis.PeacesRules.
(function (root) {
  "use strict";

  var LACE = [["white", "White"], ["black", "Black"], ["pink", "Pink"], ["coral", "Coral"], ["mint", "Mint"], ["blue", "Blue"]];
  var BEAD_TYPES = {
    ba: ["Acrylic", [["blue", "Blue"], ["green", "Green"], ["hot-pink", "Hot pink"], ["mint", "Mint"], ["orange", "Orange"], ["pink", "Pink"], ["purple", "Purple"], ["red", "Red"], ["white", "White"], ["yellow", "Yellow"]]],
    bi: ["Iridescent", [["aqua", "Aqua"], ["black", "Black"], ["lavender", "Lavender"], ["lime", "Lime"], ["mint", "Mint"], ["orange", "Orange"], ["pale-pink", "Pale pink"], ["pink", "Pink"], ["purple", "Purple"], ["red", "Red"], ["white", "White"], ["yellow", "Yellow"]]],
    bw: ["Wavy", [["brown", "Brown"], ["burgundy", "Burgundy"], ["dark-blue", "Dark blue"], ["green", "Green"], ["hot-pink", "Hot pink"], ["lavender", "Lavender"], ["light-blue", "Light blue"], ["orange", "Orange"], ["pink", "Pink"], ["red", "Red"], ["white", "White"], ["yellow", "Yellow"]]],
    bp: ["Pearl", [["16mm", "16 mm"], ["20mm", "20 mm"]]],
  };
  var BEADS = [];
  Object.keys(BEAD_TYPES).forEach(function (t) {
    BEAD_TYPES[t][1].forEach(function (c) { BEADS.push([t + "-" + c[0], BEAD_TYPES[t][0] + " · " + c[1]]); });
  });
  var CHARMS = [["cg-heart", "Gem · clear heart"], ["cg-clearrect", "Gem · clear rectangle"], ["cg-halo", "Gem · rhinestone frame"],
    ["cg-pinkbaguette", "Gem · pink rectangle"], ["cg-pinksquare", "Gem · pink square"],
    ["cp-shell", "Long · shell"], ["cp-hamsa", "Long · evil eye"], ["cp-boot", "Long · boots"], ["cp-tag", "Long · diamond star"],
    ["cp-pearls", "Long · plain pearl"], ["cp-rainbow", "Long · rainbow"], ["letters", "Letters"]];
  var CLASPS = [["plain", "Basic jump ring", 0], ["cn-big-gold", "Big gold", 10], ["cn-skinny-gold", "Skinny gold", 10],
    ["cn-skinny-rhinestone", "Skinny rhinestone", 10], ["cn-small-rhinestone", "Small rhinestone", 10]];
  var BUTTON_SIZES = [["large", "Large"], ["small", "Small"]];
  var CONNECTORS = [["c-heartring", "Heart"], ["cn-goldring", "Gold ring"], ["cn-pinkring", "Pink ring"], ["cn-bluering", "Blue ring"]];

  // A control is: choice (one of), multi (any of), count (number per spot), text (letters).
  // `per` = how many spots a count fills (2 = "each side", 4 = every tie end).
  // `needs` = only shown when another add-on / setting is present.
  var SPEC = {
    laceTrim: { name: "Lace", tier: 1, price: 15, variants: LACE, art: "p-lacetrim-",
      hint: "Along the top · bottom front or front and back",
      top: { triangle: [], underwire: [] },
      bottom: {
        triangle: [{ key: "bottom", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 5], ["around", "Front and back", 10]] }],
        seamless: [{ key: "bottom", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 5]] }],
      } },
    ruffles: { name: "Ruffles", tier: 1, price: 15, variants: [["pink", "Pink"], ["turq", "Turquoise"], ["coral", "Coral"], ["green", "Green"]], art: "p-ruffle-",
      hint: "On the top tie straps · on the sides of the bottom",
      top: { triangle: [{ key: "rtop", type: "choice", label: "Top", options: [["straps", "On the top tie straps", 0], ["none", "None", 0]] }] },
      bottom: { triangle: [{ key: "rbottom", type: "choice", label: "Bottom", options: [["sides", "On the sides", 0], ["none", "None", 0]] }] } },
    laceRuffles: { name: "Lace ruffles", tier: 1, price: 15, variants: LACE, art: "p-laceruffle-",
      hint: "Along the top · bottom front",
      top: { triangle: [], underwire: [] },
      bottom: { triangle: [{ key: "lower", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 0]] }],
                seamless: [{ key: "lower", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 0]] }] } },
    fringe: { name: "Fringe", tier: 1, price: 15, variants: [["black", "Black"], ["teal", "Teal"], ["lightpink", "Light pink"], ["darkpink", "Dark pink"]], art: "fringe-",
      hint: "Along the top · bottom front",
      top: { triangle: [], underwire: [] },
      bottom: { triangle: [{ key: "lower", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 0]] }],
                seamless: [{ key: "lower", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 0]] }] } },

    connectors: { name: "Connectors", tier: 2, price: 10, variants: CONNECTORS, art: "",
      hint: "Middle of the top · both sides of the bottom",
      top: { triangle: [], underwire: [] },
      bottom: { triangle: [{ key: "bottom", type: "choice", label: "Bottom", options: [["no", "Top only", 0], ["two", "Both sides of the bottom", 15]] }] } },
    extTies: { name: "Extended ties", tier: 2, price: 10, variants: [["match", "Matching fabric"]], art: "",
      hint: "Long matching ties",
      top: {
        triangle: [{ key: "style", type: "choice", label: "How they're worn", options: [
          ["plain", "No connector, ties cross at the waist", 0], ["wrap", "Connector in the middle, ties wrap under the bust", 0],
          ["back", "Connector in the middle, regular back tie, ties from the connector", 0]] }],
        underwire: [{ key: "style", type: "choice", label: "How they're worn", options: [["band", "From the middle knot, around the ribs", 0]] }],
      } },
    rhinestones: { name: "Rhinestones", tier: 2, price: 10, variants: [["script", "Script"]], art: "",
      hint: "Your letters in crystals · $10 per letter",
      top: { triangle: [{ key: "metal", type: "choice", label: "Finish", options: [["gold", "Gold", 0], ["silver", "Silver", 0]] },
                        { key: "place", type: "choice", label: "Placement", options: [["left", "Top, left side", 0], ["right", "Top, right side", 0]] }],
             underwire: [{ key: "metal", type: "choice", label: "Finish", options: [["gold", "Gold", 0], ["silver", "Silver", 0]] },
                         { key: "place", type: "choice", label: "Placement", options: [["left", "Top, left side", 0], ["right", "Top, right side", 0]] }] },
      bottom: { triangle: [{ key: "place", type: "choice", label: "Placement", options: [["butt", "Back of the bottoms", 0]] }] } },

    bows: { name: "Mini bows", tier: 3, price: 5, variants: [["pink", "Light pink"], ["white", "White"]], art: "p-bow-",
      hint: "$5 per spot",
      top: { triangle: [{ key: "tp", type: "multi", label: "Top", options: [["mid", "One in the middle of the string"], ["sides", "Top of each triangle (×2)"]] }],
             underwire: [{ key: "tp", type: "multi", label: "Top", options: [["mid", "One in the middle of the band"], ["sides", "Top of each side (×2)"]] }] },
      bottom: { triangle: [{ key: "bp", type: "multi", label: "Bottom", options: [["mid", "One in the middle"], ["sides", "Both sides (×2)"]] }],
                seamless: [{ key: "bp", type: "multi", label: "Bottom", options: [["mid", "One in the middle"], ["sides", "Both sides (×2)"]] }] } },
    roses: { name: "Mini roses", tier: 3, price: 5, variants: [["pink", "Pink"]], art: "p-rose",
      hint: "$5 per spot",
      top: { triangle: [{ key: "tp", type: "multi", label: "Top", options: [["mid", "One in the middle of the string"], ["sides", "Top of each triangle (×2)"]] }],
             underwire: [{ key: "tp", type: "multi", label: "Top", options: [["mid", "One in the middle of the band"], ["sides", "Top of each side (×2)"]] }] },
      bottom: { triangle: [{ key: "bp", type: "multi", label: "Bottom", options: [["mid", "One in the middle"], ["sides", "Both sides (×2)"]] }],
                seamless: [{ key: "bp", type: "multi", label: "Bottom", options: [["mid", "One in the middle"], ["sides", "Both sides (×2)"]] }] } },
    // every button spot: each button is Small or Large and they can be mixed (str.tr = ["large","small","large"])
    buttons: { name: "Buttons", tier: 3, price: 5, variants: [["white", "White"]], art: "button-white",
      hint: "$5 per button",
      top: { triangle: [{ key: "tn", type: "count", label: "Top, along the lace line", max: 6, pick: true }],
             underwire: [{ key: "tl", type: "count", label: "Top, left corner", max: 3, pick: true }, { key: "tr", type: "count", label: "Top, right corner", max: 3, pick: true }] },
      bottom: { triangle: [{ key: "bn", type: "count", label: "Bottom, along the front", max: 6, pick: true }],
                seamless: [{ key: "bl", type: "count", label: "Bottom, left corner", max: 3, pick: true }, { key: "br", type: "count", label: "Bottom, right corner", max: 3, pick: true }] } },

    beads: { name: "Beads", tier: 4, price: 5, variants: BEADS, art: "",
      hint: "Acrylic, iridescent, wavy or pearl · $5 per 3 beads",
      top: {
        triangle: [{ key: "ties", type: "count", label: "Top ties, each side", max: 10, per: 2 },
                   { key: "mid", type: "count", label: "Middle", max: 5 },
                   { key: "ext", type: "count", label: "Extended ties, each side", max: 8, per: 2, needs: "extTies" },
                   { key: "ends", type: "count", label: "Ends of the top and back ties, each end", max: 2, per: 4 }],
        underwire: [{ key: "ties", type: "count", label: "Top ties, each side", max: 5, per: 2 },
                    { key: "ext", type: "count", label: "Extended ties, each side", max: 8, per: 2, needs: "extTies" },
                    { key: "ends", type: "count", label: "Ends of the top and back ties, each end", max: 2, per: 4 }],
      },
      bottom: { triangle: [{ key: "bot", type: "count", label: "Bottom connectors, each side", max: 2, per: 2, needs: "connectors.bottom=two" }] } },
    charms: { name: "Charms", tier: 4, price: 10, variants: CHARMS, art: "",
      hint: "Gem, long or letter charms · $10 each",
      top: { triangle: [{ key: "mid", type: "count", label: "Top, middle", max: 3 }],
             underwire: [{ key: "mid", type: "count", label: "Top, middle", max: 1 },
                         { key: "ext", type: "count", label: "Extended ties, each side", max: 3, per: 2, needs: "extTies" }] },
      bottom: { triangle: [{ key: "left", type: "count", label: "Bottom, left side", max: 3 }, { key: "right", type: "count", label: "Bottom, right side", max: 3 }],
                seamless: [{ key: "left", type: "count", label: "Bottom, left side", max: 3 }, { key: "right", type: "count", label: "Bottom, right side", max: 3 }] },
      always: [{ key: "clasp", type: "choice", label: "Clasp (every charm needs one)", options: CLASPS }] },
  };

  var ORDER = ["laceTrim", "ruffles", "laceRuffles", "fringe", "connectors", "extTies", "rhinestones", "bows", "roses", "buttons", "beads", "charms"];
  var BOTTOM_FAMILY = { triangle: "triangle", seamless: "underwire" };

  function find(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i]; return null; }
  function addonCfg(d, id) { var a = (d.addons || []).filter(function (x) { return x && x.id === id; })[0]; return a ? (a.cfg || {}) : null; }
  function has(d, need) {
    var p = need.split("."), c = addonCfg(d, p[0]);
    if (!c) return false;
    if (p.length === 1) return true;
    var kv = p[1].split("="); return String(c[kv[0]]) === kv[1];
  }

  // The controls a customer sees for one add-on on this design (top piece first, then bottom).
  function controls(id, d) {
    var s = SPEC[id], out = [];
    if (!s) return out;
    var top = (s.top && s.top[d.topStyle]) || null, bot = (s.bottom && s.bottom[d.bottomStyle]) || null;
    var place = null;
    (top || []).map(function (c) { return [c, "top"]; }).concat((bot || []).map(function (c) { return [c, "bottom"]; })).forEach(function (pc) {
      var c = pc[0];
      if (c.key === "place" && id === "rhinestones") { // one Placement control across top + bottom
        if (!place) { place = { key: "place", type: "choice", label: "Placement", options: [], piece: "both", optPiece: {} }; out.push(place); }
        place.options = place.options.concat(c.options);
        c.options.forEach(function (o) { place.optPiece[o[0]] = pc[1]; });
        return;
      }
      if (c.needs && !has(d, c.needs)) return;
      var cc = Object.assign({}, c, { piece: pc[1] }); // which piece the spot is on (the builder shows it under that piece's drawing)
      if (id === "beads" && c.key === "mid" && d.topStyle === "triangle" && (has(d, "connectors") || ((addonCfg(d, "charms") || {}).mid > 0))) cc.max = 4;
      out.push(cc);
    });
    (s.always || []).forEach(function (c) { out.push(c); });
    return out;
  }
  function available(id, d) {
    var s = SPEC[id]; if (!s) return false;
    return !!((s.top && s.top[d.topStyle]) || (s.bottom && s.bottom[d.bottomStyle]));
  }
  function letters(text, max) { return String(text || "").replace(/[^A-Za-z]/g, "").slice(0, max); }

  // Checks a customer's choices and fills defaults. Throws a friendly Error when something isn't allowed.
  function normalize(id, raw, d, variant) {
    var s = SPEC[id];
    if (!s) throw new Error("Unknown add-on");
    if (!available(id, d)) throw new Error(s.name + " isn't available on these styles");
    raw = raw || {};
    var cfg = {};
    controls(id, d).forEach(function (c) {
      var v = raw[c.key];
      if (c.type === "choice") {
        if (id === "rhinestones" && c.key === "place" && v === "one") v = "left";
        if (v == null || v === "") v = c.options[0][0];
        if (!find(c.options, String(v))) throw new Error("That " + c.label.toLowerCase() + " isn't available for " + s.name.toLowerCase());
        cfg[c.key] = String(v);
      } else if (c.type === "multi") {
        var arr = Array.isArray(v) ? v.map(String) : [];
        arr.forEach(function (x) { if (!find(c.options, x)) throw new Error("That spot isn't available for " + s.name.toLowerCase()); });
        cfg[c.key] = c.options.map(function (o) { return o[0]; }).filter(function (k) { return arr.indexOf(k) > -1; });
      } else if (c.type === "count") {
        var n = v == null || v === "" ? 0 : Number(v);
        if (!Number.isInteger(n) || n < 0 || n > c.max) throw new Error(s.name + ": " + c.label.toLowerCase() + " can be 0 to " + c.max);
        cfg[c.key] = n;
      }
    });
    // beads can be mixed: each spot carries the beads in order (str.ties = ["ba-pink","bp-16mm","ba-pink"]), each side the same
    if (id === "beads" || id === "buttons") {
      var rawStr = raw.str && typeof raw.str === "object" ? raw.str : null, str = {}, pieces = id === "beads" ? BEADS : BUTTON_SIZES;
      controls(id, d).forEach(function (c) {
        if (c.type !== "count" || (id === "buttons" && !c.pick)) return;
        var list = rawStr && Array.isArray(rawStr[c.key]) ? rawStr[c.key].map(String) : null;
        if (list) {
          if (list.length > c.max) throw new Error(s.name + ": " + c.label.toLowerCase() + " can be 0 to " + c.max);
          list.forEach(function (b) { if (!find(pieces, b)) throw new Error(id === "beads" ? "That bead isn't available" : "Buttons come in small or large"); });
          cfg[c.key] = list.length;
        } else {
          var fill = id === "beads" ? (variant && find(BEADS, variant) ? variant : BEADS[0][0]) : (find(BUTTON_SIZES, String(raw.size)) ? String(raw.size) : "large");
          list = []; for (var i = 0; i < cfg[c.key]; i++) list.push(fill);
        }
        if (list.length) str[c.key] = list;
      });
      cfg.str = str;
    }
    // add-on specific rules
    if (id === "bows" || id === "roses") {
      if (!(cfg.tp || []).length && !(cfg.bp || []).length) throw new Error("Pick at least one spot for the " + s.name.toLowerCase());
    }
    if (id === "buttons" || id === "beads") {
      if (units(id, cfg, d) < 1) throw new Error("Pick how many " + s.name.toLowerCase() + " you want");
    }
    if (id === "charms") {
      if (variant && !find(s.variants, variant)) throw new Error("Unknown charm");
      if (charmCount(cfg, d, variant) < 1) throw new Error(variant === "letters" ? "Type the letters for your charms" : "Pick how many charms you want");
    }
    if (variant != null && s.variants && !find(s.variants, variant)) throw new Error("That option isn't available for " + s.name.toLowerCase());
    if (id === "extTies" && (cfg.style === "wrap" || cfg.style === "back") && !has(d, "connectors"))
      throw new Error("Pick a connector for the middle of your extended ties");
    if (id === "rhinestones") {
      var text = letters(d.rsText, cfg.place === "butt" ? 4 : 3);
      if (!text) throw new Error("Type the letters for your rhinestones");
      if (cfg.place === "butt" && /[A-Z]/.test(text)) throw new Error("Rhinestones on the back of the bottoms are lowercase only");
      if (cfg.place !== "butt" && d.sizeTop === "XS" && /[A-Z]/.test(text)) throw new Error("An XS top only fits lowercase rhinestone letters");
    }
    return cfg;
  }

  function multiplier(id, key, d) {
    var c = controls(id, d).filter(function (x) { return x.key === key; })[0];
    return c && c.per ? c.per : 1;
  }
  // how many beads / buttons / charms in total
  function units(id, cfg, d) {
    var n = 0;
    controls(id, d).forEach(function (c) { if (c.type === "count") n += (cfg[c.key] || 0) * (c.per || 1); });
    return n;
  }
  function charmCount(cfg, d, variant) {
    if (variant === "letters") return letters(d.initials, d.topStyle === "underwire" ? 1 : 3).length + units("charms", Object.assign({}, cfg, { mid: 0 }), d);
    return units("charms", cfg, d);
  }

  function price(id, cfg, d, variant) {
    var s = SPEC[id], p = s.price;
    if (id === "bows" || id === "roses") return s.price * ((cfg.tp || []).length + (cfg.bp || []).length);
    if (id === "buttons") return s.price * units(id, cfg, d);
    if (id === "beads") return 5 * Math.ceil(units(id, cfg, d) / 3);
    if (id === "charms") {
      var clasp = find(CLASPS, cfg.clasp) || CLASPS[0];
      return charmCount(cfg, d, variant) * (s.price + clasp[2]);
    }
    if (id === "rhinestones") return s.price * Math.max(1, letters(d.rsText, cfg.place === "butt" ? 4 : 3).length);
    controls(id, d).forEach(function (c) {
      if (c.type === "choice") { var o = find(c.options, cfg[c.key]); if (o && o[2]) p += o[2]; }
    });
    return p;
  }

  // "Top ties ×10 each side, Middle ×3" style summary for the cart and the order
  function describe(id, cfg, d, variant) {
    var bits = [];
    controls(id, d).forEach(function (c) {
      var v = cfg[c.key];
      if (c.type === "choice") { var o = find(c.options, v); if (o) bits.push(c.key === "clasp" ? o[1] + " clasp" : o[1]); }
      else if (c.type === "multi") { (v || []).forEach(function (k) { bits.push(c.label + ": " + find(c.options, k)[1]); }); }
      else if (c.type === "count" && v) bits.push(c.label + " ×" + v + (cfg.str && cfg.str[c.key] ? ": " + beadList(cfg.str[c.key], id === "beads" ? BEADS : BUTTON_SIZES) : ""));
    });
    if (id === "charms" && variant === "letters") bits.unshift(letters(d.initials, d.topStyle === "underwire" ? 1 : 3).toUpperCase() + " in the middle");
    if (id === "rhinestones") bits.unshift(letters(d.rsText, cfg.place === "butt" ? 4 : 3));
    return bits.join(", ");
  }
  // "Acrylic · Pink ×2, Pearl · 16 mm" (in order along the spot)
  function beadList(list, opts) {
    opts = opts || BEADS;
    var out = [];
    list.forEach(function (b) {
      var last = out[out.length - 1];
      if (last && last.b === b) last.n++; else out.push({ b: b, n: 1 });
    });
    return out.map(function (x) { var o = find(opts, x.b); return (o ? o[1] : x.b) + (x.n > 1 ? " ×" + x.n : ""); }).join(", ");
  }
  function variantName(id, v) {
    var s = SPEC[id], o = s && find(s.variants, v);
    return o ? o[1] : "";
  }

  root.PeacesRules = { SPEC: SPEC, ORDER: ORDER, BEAD_TYPES: BEAD_TYPES, CLASPS: CLASPS, CONNECTORS: CONNECTORS, BOTTOM_FAMILY: BOTTOM_FAMILY,
    BEADS: BEADS, BUTTON_SIZES: BUTTON_SIZES, beadList: beadList, controls: controls, available: available, normalize: normalize, price: price, describe: describe, units: units,
    variantName: variantName, letters: letters, has: has };
})(typeof globalThis !== "undefined" ? globalThis : this);
