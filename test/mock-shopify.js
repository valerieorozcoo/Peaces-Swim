// Fake Shopify Admin API for tests — answers the exact queries the backend sends.
import http from "node:http";

export function startMockShopify(port) {
  const db = { customers: [], drafts: [], tokenCalls: 0, calls: [] };
  const server = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    const send = (o, s = 200) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/admin/oauth/access_token") {
      const p = new URLSearchParams(raw);
      db.tokenCalls++;
      if (p.get("grant_type") !== "client_credentials" || p.get("client_secret") !== "test-secret") return send({ error: "invalid_client" }, 401);
      return send({ access_token: "tok_123", scope: "read_customers,write_customers,write_draft_orders", expires_in: 86399 });
    }
    if (!/^\/admin\/api\/[\d-]+\/graphql\.json$/.test(req.url)) return send({}, 404);
    if (req.headers["x-shopify-access-token"] !== "tok_123") return send({ errors: "Invalid API key or access token" }, 401);
    const { query, variables } = JSON.parse(raw);
    db.calls.push({ query, variables });
    if (query.includes("shop { name }")) return send({ data: { shop: { name: "Peaces Swim (mock)" } } });
    if (query.includes("customers(first:1")) {
      const m = /^(phone|email):"?([^"]*)"?$/.exec(variables.q) || [];
      const nodes = db.customers.filter((c) => (m[1] === "email" ? (c.email || "").toLowerCase() === m[2] : c.phone === m[2]));
      return send({ data: { customers: { nodes: nodes.map((c) => ({ ...c, tags: c.tags || [] })) } } });
    }
    if (query.includes("customerUpdate")) {
      const { id, ...rest } = variables.input;
      const c = db.customers.find((x) => x.id === id);
      if (rest.phone && db.customers.some((x) => x.id !== id && x.phone === rest.phone))
        return send({ data: { customerUpdate: { customer: null, userErrors: [{ field: ["phone"], message: "Phone has already been taken" }] } } });
      Object.assign(c, rest);
      return send({ data: { customerUpdate: { customer: { id }, userErrors: [] } } });
    }
    if (query.includes("tagsAdd")) {
      const c = db.customers.find((x) => x.id === variables.id);
      if (!c) return send({ data: { tagsAdd: { userErrors: [{ field: ["id"], message: "not found" }] } } });
      c.tags = [...new Set([...(c.tags || []), ...variables.tags])];
      return send({ data: { tagsAdd: { userErrors: [] } } });
    }
    if (query.includes("customerCreate")) {
      const i = variables.input;
      if (db.customers.some((c) => c.email === i.email)) return send({ data: { customerCreate: { customer: null, userErrors: [{ field: ["email"], message: "Email has already been taken" }] } } });
      const c = { id: "gid://shopify/Customer/" + (db.customers.length + 1), ...i };
      db.customers.push(c);
      return send({ data: { customerCreate: { customer: { id: c.id, firstName: c.firstName }, userErrors: [] } } });
    }
    if (query.includes("draftOrderCreate")) {
      const i = variables.input;
      const sub = i.lineItems.reduce((s, l) => s + +l.originalUnitPriceWithCurrency.amount, 0);
      const tot = i.appliedDiscount ? sub * (1 - i.appliedDiscount.value / 100) : sub;
      const d = { id: "gid://shopify/DraftOrder/" + (1000 + db.drafts.length), name: "#D" + (db.drafts.length + 1), input: i };
      db.drafts.push(d);
      return send({ data: { draftOrderCreate: { draftOrder: { id: d.id, name: d.name, invoiceUrl: "https://example.com/invoice/" + d.name.slice(1),
        subtotalPriceSet: { shopMoney: { amount: sub.toFixed(2) } }, totalPriceSet: { shopMoney: { amount: tot.toFixed(2) } } }, userErrors: [] } } });
    }
    if (query.includes("draftOrderUpdate")) {
      const d = db.drafts.find((x) => x.id === variables.id);
      if (!d) return send({ data: { draftOrderUpdate: { draftOrder: null, userErrors: [{ field: ["id"], message: "not found" }] } } });
      d.update = variables.input;
      return send({ data: { draftOrderUpdate: { draftOrder: { id: d.id }, userErrors: [] } } });
    }
    send({ errors: [{ message: "unknown query" }] }, 400);
  });
  return new Promise((r) => server.listen(port, () => r({ server, db })));
}
