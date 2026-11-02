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
    if (req.url === "/staged-upload") { db.uploads = (db.uploads || 0) + 1; db.uploadBytes = raw.length; res.writeHead(204); return res.end(); }
    if (!/^\/admin\/api\/[\d-]+\/graphql\.json$/.test(req.url)) return send({}, 404);
    if (req.headers["x-shopify-access-token"] !== "tok_123") return send({ errors: "Invalid API key or access token" }, 401);
    const { query, variables } = JSON.parse(raw);
    db.calls.push({ query, variables });
    if (query.includes("currentAppInstallation")) return send({ data: { currentAppInstallation: { accessScopes: [{ handle: "write_files" }, { handle: "write_draft_orders" }] } } });
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
    if (query.includes("customerSmsMarketingConsentUpdate")) {
      const { customerId, smsMarketingConsent } = variables.input;
      const c = db.customers.find((x) => x.id === customerId);
      if (!c || !c.phone) return send({ data: { customerSmsMarketingConsentUpdate: { userErrors: [{ field: ["customerId"], message: "Customer must have a phone number" }] } } });
      c.smsMarketingConsent = smsMarketingConsent;
      return send({ data: { customerSmsMarketingConsentUpdate: { userErrors: [] } } });
    }
    if ((query.includes("tagsAdd") || query.includes("tagsRemove")) && /DraftOrder/.test(variables.id)) {
      const op = query.includes("tagsAdd") ? "tagsAdd" : "tagsRemove";
      const d = db.drafts.find((x) => x.id === variables.id);
      if (!d) return send({ data: { [op]: { userErrors: [{ field: ["id"], message: "not found" }] } } });
      const extra = new Set(d.extraTags || []);
      variables.tags.forEach((t) => (op === "tagsAdd" ? extra.add(t) : extra.delete(t)));
      d.extraTags = [...extra];
      return send({ data: { [op]: { userErrors: [] } } });
    }
    if (query.includes("draftOrders(first:")) {
      const view = (d) => ({ id: d.id, name: d.name, createdAt: d.createdAt, status: d.status || "OPEN", email: null, customer: null,
        tags: [...((d.update && d.update.tags) || d.input.tags || []), ...(d.extraTags || [])],
        customAttributes: (d.update && d.update.customAttributes) || d.input.customAttributes || [],
        lineItems: { nodes: d.input.lineItems.map((l) => ({ title: l.title, quantity: l.quantity || 1, customAttributes: l.customAttributes || [] })) } });
      db.lastDraftQuery = variables && variables.q;
      return send({ data: { draftOrders: { nodes: db.drafts.filter((d) => !variables || (d.input.tags || []).includes("peaces-builder")).map(view) } } });
    }
    if (query.includes("draftOrder(id:")) {
      const d = db.drafts.find((x) => x.id === variables.id);
      return send({ data: { draftOrder: d ? { customAttributes: (d.update && d.update.customAttributes) || d.input.customAttributes || [] } : null } });
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
    if (query.includes("stagedUploadsCreate")) {
      return send({ data: { stagedUploadsCreate: { stagedTargets: [{ url: "http://localhost:" + port + "/staged-upload", resourceUrl: "https://shopify-staged/tmp/" + variables.input[0].filename,
        parameters: [{ name: "key", value: "tmp/" + variables.input[0].filename }] }], userErrors: [] } } });
    }
    if (query.includes("fileCreate")) {
      return send({ data: { fileCreate: { files: [{ id: "gid://shopify/MediaImage/1", image: null }], userErrors: [] } } });
    }
    if (query.includes("node(id:")) {
      return send({ data: { node: { fileStatus: "READY", image: { url: "https://cdn.shopify.com/s/files/peaces-design.jpg" } } } });
    }
    if (query.includes("draftOrderCreate")) {
      const i = variables.input;
      const sub = i.lineItems.reduce((s, l) => s + +l.originalUnitPriceWithCurrency.amount * (l.quantity || 1), 0);
      const tot = i.appliedDiscount ? sub * (1 - i.appliedDiscount.value / 100) : sub;
      const d = { id: "gid://shopify/DraftOrder/" + (1000 + db.drafts.length), name: "#D" + (db.drafts.length + 1), input: i, createdAt: new Date().toISOString() };
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
