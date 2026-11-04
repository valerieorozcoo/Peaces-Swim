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
    ["cp-pearls", "Long · plain pearl"], ["cp-rainbow", "Long · rainbow"], ["letters", "Letter"]];
  var CLASPS = [["plain", "Basic jump ring", 0], ["cn-big-gold", "Big gold", 5], ["cn-skinny-gold", "Skinny gold", 5],
    ["cn-skinny-rhinestone", "Skinny rhinestone", 5], ["cn-small-rhinestone", "Small rhinestone", 5]];
  var BUTTON_SIZES = [["large", "Large"], ["small", "Small"]];
  // a letter charm is written with its letter ("Letter K") wherever the charms are listed
  function pieceNames(id, list, d) { return id === "charms" ? list.map(function (b) { return b === "letters" ? "letter:" + letters(d.initials, 1).toUpperCase() : b; }) : list; }
  var CONNECTORS = [["c-heartring", "Heart"], ["cn-goldring", "Gold ring"], ["cn-pinkring", "Pink ring"], ["cn-bluering", "Blue ring"]];

  // A control is: choice (one of), multi (any of), count (number per spot), text (letters).
  // `per` = how many spots a count fills (2 = "each side", 4 = every tie end).
  // `needs` = only shown when another add-on / setting is present.
  var SPEC = {
    laceTrim: { name: "Lace", tier: 1, price: 15, variants: LACE, art: "p-lacetrim-",
      hint: "Along the top · across the top of the bottom, front or all around",
      top: { triangle: [], underwire: [] },
      bottom: {
        triangle: [{ key: "bottom", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 0], ["around", "All around", 5]] }],
        seamless: [{ key: "bottom", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 0]] }],
      } },
    ruffles: { name: "Ruffles", tier: 1, price: 15, variants: [["cheetah", "Cheetah"], ["mint", "Mint"]], art: "p-ruffle-p-",
      hint: "On the top tie straps · on the sides of the bottom",
      top: { triangle: [{ key: "rtop", type: "choice", label: "Top", options: [["straps", "On the top tie straps", 0], ["none", "None", 0]] }] },
      bottom: { triangle: [{ key: "rbottom", type: "choice", label: "Bottom", options: [["sides", "On the sides", 0], ["none", "None", 0]] }] } },
    laceRuffles: { name: "Lace ruffles", tier: 1, price: 15, variants: LACE, art: "p-laceruffle-p-",
      hint: "Along the top · across the top of the bottom, front or all around",
      top: { triangle: [], underwire: [] },
      // "All around" = across the top of the bottom, front and back (never down the sides)
      bottom: { triangle: [{ key: "lower", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 0], ["around", "All around", 0]] }],
                seamless: [{ key: "lower", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 0], ["around", "All around", 0]] }] } },
    fringe: { name: "Fringe", tier: 1, price: 15, variants: [["black", "Black"], ["teal", "Teal"], ["lightpink", "Light pink"], ["darkpink", "Dark pink"]], art: "fringe-p-",
      hint: "Along the top · bottom front",
      top: { triangle: [], underwire: [] },
      bottom: { triangle: [{ key: "lower", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 0]] }],
                seamless: [{ key: "lower", type: "choice", label: "Bottom", options: [["none", "Top only", 0], ["front", "Front only", 0]] }] } },

    connectors: { name: "Connectors", tier: 2, price: 10, variants: CONNECTORS, art: "",
      hint: "Middle of the top · both sides of the bottom",
      // triangle: $10 for the middle of the top (or None, for bottoms only) + $15 for both sides of the bottom
      top: { triangle: [{ key: "top", type: "choice", label: "Top", options: [["mid", "Middle", 0], ["none", "None", -10]] }], underwire: [] },
      bottom: { triangle: [{ key: "bottom", type: "choice", label: "Bottom", options: [["no", "Top only", 0], ["two", "Both sides of the bottom", 15]] }] } },
    extTies: { name: "Extended ties", tier: 2, price: 10, variants: [["match", "Matching fabric"]], art: "",
      hint: "Long matching ties",
      top: {
        triangle: [{ key: "style", type: "choice", label: "How they're worn", options: [
          ["plain", "No connector, ties cross at the waist", 0], ["wrap", "Connector in the middle, ties wrap under the bust", 0],
          ["back", "Connector in the middle, ties cross at the waist", 0]] }],
        underwire: [{ key: "style", type: "choice", label: "How they're worn", options: [["band", "From the middle knot, around the ribs", 0]] }],
      } },
    rhinestones: { name: "Rhinestones", tier: 2, price: 10, variants: [["script", "Script"]], art: "",
      hint: "Your letters in crystals · $10 per letter",
      top: { triangle: [{ key: "metal", type: "choice", label: "Finish", options: [["gold", "Gold", 0], ["silver", "Silver", 0]] },
                        { key: "place", type: "choice", label: "Placement", options: [["left", "Top, left side", 0], ["right", "Top, right side", 0]] }],
             underwire: [{ key: "metal", type: "choice", label: "Finish", options: [["gold", "Gold", 0], ["silver", "Silver", 0]] },
                         { key: "place", type: "choice", label: "Placement", options: [["left", "Top, left side", 0], ["right", "Top, right side", 0]] }] },
      bottom: { triangle: [{ key: "place", type: "choice", label: "Placement", options: [["butt", "Back of the bottoms", 0]] }] } },

    bows: { name: "Mini bows", tier: 3, price: 5, variants: [["pink", "Light pink"], ["white", "White"], ["black", "Black"]], art: "p-bow-",
      hint: "$5 · up to 5",
      top: { triangle: [{ key: "tp", type: "multi", label: "Top", options: [["mid", "One in the middle of the string"], ["sides", "Both sides"]] }],
             underwire: [{ key: "tp", type: "multi", label: "Top", options: [["mid", "One in the middle of the band"], ["sides", "Both sides"]] }] },
      bottom: { triangle: [{ key: "bp", type: "multi", label: "Bottom", options: [["mid", "One in the middle"], ["sides", "Both sides"]] }],
                seamless: [{ key: "bp", type: "multi", label: "Bottom", options: [["mid", "One in the middle"], ["sides", "Both sides"]] }] } },
    roses: { name: "Mini roses", tier: 3, price: 5, variants: [["pink", "Pink"]], art: "p-rose-leaf",
      hint: "$5 · up to 5",
      top: { triangle: [{ key: "tp", type: "multi", label: "Top", options: [["mid", "One in the middle of the string"], ["sides", "Top of each triangle"]] }],
             underwire: [{ key: "tp", type: "multi", label: "Top", options: [["mid", "One in the middle of the band"], ["sides", "Top of each side"]] }] },
      bottom: { triangle: [{ key: "bp", type: "multi", label: "Bottom", options: [["mid", "One in the middle"], ["sides", "Both sides"]] }],
                seamless: [{ key: "bp", type: "multi", label: "Bottom", options: [["mid", "One in the middle"], ["sides", "Both sides"]] }] } },
    // every button spot: each button is Small or Large and they can be mixed (str.tr = ["large","small","large"])
    buttons: { name: "Buttons", tier: 3, price: 5, variants: [["white", "White"]], art: "button-pearl",
      hint: "$5 for every 3",
      top: { triangle: [{ key: "tn", type: "count", label: "Top, along the lace line", max: 12, pick: true }],
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
    charms: { name: "Charms", tier: 4, price: 7, variants: CHARMS, art: "",
      hint: "Gem, long or letter charms · $7 each",
      top: { triangle: [{ key: "mid", type: "count", label: "Top, middle", max: 3 }],
             underwire: [{ key: "mid", type: "count", label: "Top, middle", max: 1 }] },
      bottom: { triangle: [{ key: "left", type: "count", label: "Bottom, left side", max: 3 }, { key: "right", type: "count", label: "Bottom, right side", max: 3 }],
                seamless: [{ key: "left", type: "count", label: "Bottom, left side", max: 3 }, { key: "right", type: "count", label: "Bottom, right side", max: 3 }] },
      always: [{ key: "clasp", type: "choice", label: "Clasp (every charm needs one)", options: CLASPS }] },
  };

  // Which fabrics each piece comes in. Mint + cheetah seamless sets are a small limited run.
  var FABRICS = {
    top: { triangle: ["green", "cheetah"], underwire: ["teal", "coral", "green", "cheetah"] },
    bottom: { triangle: ["green", "cheetah"], seamless: ["teal", "coral", "green", "cheetah"] },
  };
  // Sold out pieces, as "part:style:color" (e.g. "bottom:seamless:cheetah"). They show crossed out and
  // checkout refuses them. Shopify inventory will fill this in later; for now everything is in stock.
  var SOLD_OUT = [];
  function soldOut(part, style, color) { return SOLD_OUT.indexOf(part + ":" + style + ":" + color) > -1; }
  function fabricOk(part, style, color) { var f = FABRICS[part] && FABRICS[part][style]; return !!f && f.indexOf(color) > -1 && !soldOut(part, style, color); }

  var PIECES = { beads: BEADS, buttons: BUTTON_SIZES, charms: CHARMS };
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
      if (id === "beads" && c.key === "mid" && d.topStyle === "triangle" && (midConnector(d) || ((addonCfg(d, "charms") || {}).mid > 0))) cc.max = 4;
      out.push(cc);
    });
    (s.always || []).forEach(function (c) { out.unshift(c); }); // e.g. the charm clasp is chosen first
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
    // beads, buttons and charms can be mixed: each spot lists its pieces in order
    if (id === "beads" || id === "buttons" || id === "charms") {
      var rawStr = raw.str && typeof raw.str === "object" ? raw.str : null, str = {}, pieces = PIECES[id];
      controls(id, d).forEach(function (c) {
        if (c.type !== "count" || (id === "buttons" && !c.pick)) return;
        var list = rawStr && Array.isArray(rawStr[c.key]) ? rawStr[c.key].map(String) : null;
        if (list) {
          if (list.length > c.max) throw new Error(s.name + ": " + c.label.toLowerCase() + " can be 0 to " + c.max);
          list.forEach(function (b) { if (!find(pieces, b)) throw new Error(id === "beads" ? "That bead isn't available" : id === "charms" ? "Unknown charm" : "Buttons come in small or large"); });
          cfg[c.key] = list.length;
        } else {
          var fill = id === "buttons" ? (find(BUTTON_SIZES, String(raw.size)) ? String(raw.size) : "large") : (variant && find(pieces, variant) ? variant : pieces[0][0]);
          list = []; for (var i = 0; i < cfg[c.key]; i++) list.push(fill);
        }
        if (list.length) str[c.key] = list;
      });
      cfg.str = str;
    }
    // add-on specific rules
    if (id === "bows" || id === "roses") {
      if (!(cfg.tp || []).length && !(cfg.bp || []).length) throw new Error("Pick at least one spot for the " + s.name.toLowerCase());
      if (pieceCount(cfg) > MAX_SPOTS) throw new Error("Up to " + MAX_SPOTS + " " + s.name.toLowerCase().replace("mini ", "") + " (both sides counts as 2)");
    }
    if (id === "buttons" || id === "beads") {
      if (units(id, cfg, d) < 1) throw new Error("Pick how many " + s.name.toLowerCase() + " you want");
    }
    if (id === "charms") {
      if (variant && !find(s.variants, variant)) throw new Error("Unknown charm");
      if (charmCount(cfg, d, variant) < 1) throw new Error("Pick how many charms you want");
      if (usesLetter(cfg, variant) && !letters(d.initials, 1)) throw new Error("Type the letter for your charm");
      // the seamless bottom has no tie to hang from: charms there need a clasp upgrade, not the basic jump ring
      if (d.bottomStyle === "seamless" && ((cfg.left || 0) + (cfg.right || 0)) > 0 && cfg.clasp === "plain")
        throw new Error("Charms on the seamless bottom need a clasp upgrade");
    }
    if (id === "connectors" && cfg.top === "none" && cfg.bottom !== "two") throw new Error("Pick at least one connector");
    if (variant != null && s.variants && !find(s.variants, variant)) throw new Error("That option isn't available for " + s.name.toLowerCase());
    if (id === "extTies" && (cfg.style === "wrap" || cfg.style === "back") && !midConnector(d))
      throw new Error("Pick a connector for the middle of your extended ties");
    if (id === "rhinestones") {
      var text = letters(d.rsText, cfg.place === "butt" ? 4 : 3);
      if (!text) throw new Error("Type the letters for your rhinestones");
      if (cfg.place === "butt" && /[A-Z]/.test(text)) throw new Error("Rhinestones on the back of the bottoms are lowercase only");
      if (cfg.place !== "butt" && d.sizeTop === "XS" && /[A-Z]/.test(text)) throw new Error("Uppercase rhinestones are too big for an XS top");
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
  function usesLetter(cfg, variant) {
    var str = cfg && cfg.str;
    if (str && Object.keys(str).some(function (k) { return (str[k] || []).length; })) return Object.keys(str).some(function (k) { return str[k].indexOf("letters") > -1; });
    return variant === "letters";
  }
  // bows + roses: "both sides" is 2 pieces, "middle" is 1; up to 5 pieces for the flat $5
  var MAX_SPOTS = 5;
  function pieceCount(cfg) { return (cfg.tp || []).concat(cfg.bp || []).reduce(function (n, k) { return n + (k === "sides" ? 2 : 1); }, 0); }
  function charmCount(cfg, d, variant) { return units("charms", cfg, d); } // a letter charm is one letter, placed like any other charm
  // the middle connector on a triangle top (connectors with "None" on top are bottoms only)
  function midConnector(d) { var c = addonCfg(d, "connectors"); return !!c && d.topStyle === "triangle" && c.top !== "none"; }

  function price(id, cfg, d, variant) {
    var s = SPEC[id], p = s.price;
    if (id === "bows" || id === "roses") return s.price;                    // $5 flat, up to 5
    if (id === "buttons") return 5 * Math.ceil(units(id, cfg, d) / 3);   // $5 for every 3 buttons
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
      else if (c.type === "count" && v) bits.push(c.label + " ×" + v + (cfg.str && cfg.str[c.key] ? ": " + beadList(pieceNames(id, cfg.str[c.key], d), PIECES[id]) : ""));
    });
    if (id === "charms" && !(cfg.str && Object.keys(cfg.str).length) && variant === "letters") bits.unshift(letters(d.initials, 1).toUpperCase());
    if (id === "rhinestones") bits.unshift(letters(d.rsText, cfg.place === "butt" ? 4 : 3));
    return bits.join(", ");
  }
  // ---------- Spanish (Latin American) for the seamstress tags ----------
  var ES = {
    "Lace": "Encaje", "White": "Blanco", "Black": "Negro", "Pink": "Rosado", "Coral": "Coral", "Mint": "Menta", "Blue": "Azul",
    "Bottom": "Parte de abajo", "Top": "Parte de arriba", "Top only": "Ninguno", "Front only": "Solo adelante", "Front and back": "Adelante y atrás", "All around": "Alrededor de todo",
    "Ruffles": "Volantes", "Cheetah": "Animal print (cheetah)", "On the top tie straps": "En las tiras del top", "None": "Ninguno", "On the sides": "A los lados",
    "Lace ruffles": "Volantes de encaje", "Fringe": "Flecos", "Teal": "Verde azulado", "Light pink": "Rosado claro", "Dark pink": "Rosado oscuro",
    "Connectors": "Conectores", "Heart": "Corazón", "Gold ring": "Argolla dorada", "Pink ring": "Argolla rosada", "Blue ring": "Argolla azul",
    "Middle": "En el centro", "Both sides of the bottom": "A ambos lados de la parte de abajo",
    "Extended ties": "Tiras extra largas", "Matching fabric": "Misma tela", "How they're worn": "Cómo se usan",
    "No connector, ties cross at the waist": "Sin conector, las tiras se cruzan en la cintura",
    "Connector in the middle, ties wrap under the bust": "Conector en el centro, las tiras rodean por debajo del busto",
    "Connector in the middle, ties cross at the waist": "Conector en el centro, las tiras se cruzan en la cintura",
    "From the middle knot, around the ribs": "Desde el nudo del centro, alrededor de las costillas",
    "Rhinestones": "Letras de pedrería", "Script": "Cursiva", "Finish": "Acabado", "Gold": "Dorado", "Silver": "Plateado", "Placement": "Ubicación",
    "Top, left side": "Arriba, lado izquierdo", "Top, right side": "Arriba, lado derecho", "Back of the bottoms": "Atrás, en la parte de abajo",
    "Mini bows": "Mini moños", "Both sides": "Ambos lados", "One in the middle of the string": "Uno en el centro de la tira",
    "One in the middle of the band": "Uno en el centro de la banda", "One in the middle": "Uno en el centro",
    "Mini roses": "Mini rosas", "Top of each triangle": "Arriba de cada triángulo", "Top of each side": "Arriba de cada lado",
    "Buttons": "Botones", "Top, along the lace line": "Arriba, a lo largo de la línea del encaje", "Top, left corner": "Arriba, esquina izquierda",
    "Top, right corner": "Arriba, esquina derecha", "Bottom, along the front": "Abajo, a lo largo del frente",
    "Bottom, left corner": "Abajo, esquina izquierda", "Bottom, right corner": "Abajo, esquina derecha",
    "Beads": "Cuentas", "Top ties, each side": "Tiras del top, cada lado", "Extended ties, each side": "Tiras largas, cada lado",
    "Ends of the top and back ties, each end": "Puntas de las tiras de arriba y de la espalda, cada punta",
    "Bottom connectors, each side": "Conectores de abajo, cada lado",
    "Charms": "Dijes", "Gem · clear heart": "Gema · corazón transparente", "Gem · clear rectangle": "Gema · rectángulo transparente",
    "Gem · rhinestone frame": "Gema · marco de pedrería", "Gem · pink rectangle": "Gema · rectángulo rosado", "Gem · pink square": "Gema · cuadrado rosado",
    "Long · shell": "Largo · concha", "Long · evil eye": "Largo · ojo turco", "Long · boots": "Largo · botas", "Long · diamond star": "Largo · estrella de diamante",
    "Long · plain pearl": "Largo · perla sencilla", "Long · rainbow": "Largo · arcoíris", "Letter": "Letra",
    "Top, middle": "Arriba, centro", "Bottom, left side": "Abajo, lado izquierdo", "Bottom, right side": "Abajo, lado derecho",
    "Basic jump ring": "Argolla básica", "Big gold": "Dorado grande", "Skinny gold": "Dorado delgado", "Skinny rhinestone": "Pedrería delgada", "Small rhinestone": "Pedrería pequeña",
    "Acrylic": "Acrílica", "Green": "Verde", "Hot pink": "Fucsia", "Orange": "Naranja", "Purple": "Morado", "Red": "Rojo", "Yellow": "Amarillo",
    "Iridescent": "Tornasolada", "Aqua": "Aguamarina", "Lavender": "Lavanda", "Lime": "Verde lima", "Pale pink": "Rosado pálido",
    "Wavy": "Ondulada", "Brown": "Café", "Burgundy": "Vinotinto", "Dark blue": "Azul oscuro", "Light blue": "Azul claro", "Pearl": "Perla",
    "Large": "Grande", "Small": "Pequeño",
    // pieces, fabrics and extras
    "Triangle top": "Top triángulo", "Bralette top": "Top bralette", "Triangle bottom": "Parte de abajo triángulo", "Seamless bottom": "Parte de abajo seamless (fruncida)",
    "Peaces terry tote": "Bolso de toalla Peaces", "Peaces headband": "Banda para el cabello Peaces",
  };
  function es(t) { return ES[t] || (/ · /.test(t) ? t.split(" · ").map(function (x) { return ES[x] || x; }).join(" · ") : t); }
  function beadListEs(list, opts) { return beadList(list, opts).split(", ").map(function (x) { var m = /^(.*?)( ×\d+)?$/.exec(x); var lt = /^Letter (.*)$/.exec(m[1]); return (lt ? "Letra " + lt[1] : es(m[1])) + (m[2] || ""); }).join(", "); }
  function describeEs(id, cfg, d, variant) {
    var bits = [];
    controls(id, d).forEach(function (c) {
      var v = cfg[c.key];
      if (c.type === "choice") { var o = find(c.options, v); if (o) bits.push(c.key === "clasp" ? "Broche: " + es(o[1]) : es(o[1])); }
      else if (c.type === "multi") { (v || []).forEach(function (k) { bits.push(es(c.label) + ": " + es(find(c.options, k)[1])); }); }
      else if (c.type === "count" && v) bits.push(es(c.label) + " ×" + v + (cfg.str && cfg.str[c.key] ? ": " + beadListEs(pieceNames(id, cfg.str[c.key], d), PIECES[id]) : ""));
    });
    if (id === "charms" && !(cfg.str && Object.keys(cfg.str).length) && variant === "letters") bits.unshift(letters(d.initials, 1).toUpperCase());
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
    return out.map(function (x) { var o = find(opts, x.b), lt = /^letter:(.*)$/.exec(x.b); return (lt ? "Letter " + lt[1] : o ? o[1] : x.b) + (x.n > 1 ? " ×" + x.n : ""); }).join(", ");
  }
  // Sewing time (minutes) the team estimated for each customization, used for the customer's
  // wait / pickup time and shown to the seamstresses. A plain bikini starts at BASE_MINUTES.
  var BASE_MINUTES = 5;
  var MINUTES = { laceTrim: 5, laceRuffles: 8, ruffles: 8, fringe: 4, extTies: 2, rhinestones: 3, charms: 2, beads: 2 };
  function spots(list) { return (list || []).reduce(function (n, k) { return n + (k === "sides" ? 2 : 1); }, 0); }
  function minutes(id, cfg, d) {
    cfg = cfg || {};
    if (id === "connectors") return 2 * ((cfg.top === "none" ? 0 : 1) + (cfg.bottom === "two" ? 2 : 0)); // 2 min per connector
    if (id === "roses" || id === "bows") return spots(cfg.tp) + spots(cfg.bp);                           // 1 min per rose / bow
    if (id === "buttons") return 2 * units(id, cfg, d);                                                 // 2 min per button
    return MINUTES[id] || 0;
  }
  // d = { topStyle, bottomStyle, addons:[{id, cfg}] } with cfg already normalized
  function designMinutes(d) {
    return BASE_MINUTES + (d.addons || []).reduce(function (n, a) { return n + minutes(a.id, a.cfg, d); }, 0);
  }

  function variantName(id, v) {
    var s = SPEC[id], o = s && find(s.variants, v);
    return o ? o[1] : "";
  }

  root.PeacesRules = { FABRICS: FABRICS, SOLD_OUT: SOLD_OUT, soldOut: soldOut, fabricOk: fabricOk, SPEC: SPEC, ORDER: ORDER, BEAD_TYPES: BEAD_TYPES, CLASPS: CLASPS, CONNECTORS: CONNECTORS, BOTTOM_FAMILY: BOTTOM_FAMILY,
    BEADS: BEADS, BUTTON_SIZES: BUTTON_SIZES, beadList: beadList, es: es, describeEs: describeEs, controls: controls, available: available, normalize: normalize, price: price, describe: describe, units: units,
    variantName: variantName, letters: letters, has: has, PIECES: PIECES, usesLetter: usesLetter, pieceCount: pieceCount, MAX_SPOTS: MAX_SPOTS, BASE_MINUTES: BASE_MINUTES, MINUTES: MINUTES, minutes: minutes, designMinutes: designMinutes };
})(typeof globalThis !== "undefined" ? globalThis : this);
