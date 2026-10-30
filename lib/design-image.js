// Saves the picture of the customer's built bikini to Shopify Files so it can go on the
// order (and the receipt email). Needs the write_files scope. Never throws: if the picture
// can't be saved the order still goes through, just without it.
import { gql, check } from "./shopify.js";

const MAX_BYTES = 2_500_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function saveDesignImage(dataUrl, label) {
  try {
    const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
    if (!m) return null;
    const bytes = Buffer.from(m[2], "base64");
    if (!bytes.length || bytes.length > MAX_BYTES) return null;
    const mimeType = "image/" + m[1], filename = "peaces-design-" + Date.now() + (m[1] === "png" ? ".png" : ".jpg");

    const st = await gql(
      `mutation($input:[StagedUploadInput!]!){ stagedUploadsCreate(input:$input){
         stagedTargets{ url resourceUrl parameters{ name value } } userErrors{ field message } } }`,
      { input: [{ resource: "IMAGE", filename, mimeType, httpMethod: "POST", fileSize: String(bytes.length) }] }
    );
    const target = check(st.stagedUploadsCreate, "stagedUploadsCreate").stagedTargets[0];
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append("file", new Blob([bytes], { type: mimeType }), filename);
    const up = await fetch(target.url, { method: "POST", body: form });
    if (!up.ok) throw new Error("upload failed " + up.status);

    const fc = await gql(
      `mutation($files:[FileCreateInput!]!){ fileCreate(files:$files){
         files{ id ... on MediaImage{ image{ url } } } userErrors{ field message } } }`,
      { files: [{ originalSource: target.resourceUrl, contentType: "IMAGE", alt: label || "Peaces Swim custom design" }] }
    );
    const file = check(fc.fileCreate, "fileCreate").files[0];
    if (file.image && file.image.url) return file.image.url;
    for (let i = 0; i < 8; i++) { // Shopify processes the image for a moment before the URL exists
      await sleep(600);
      const q = await gql(`query($id:ID!){ node(id:$id){ ... on MediaImage{ fileStatus image{ url } } } }`, { id: file.id });
      const n = q.node || {};
      if (n.image && n.image.url) return n.image.url;
      if (n.fileStatus === "FAILED") return null;
    }
    return null;
  } catch (e) {
    console.error("[design-image]", e.message, JSON.stringify(e.details || ""));
    return null;
  }
}
