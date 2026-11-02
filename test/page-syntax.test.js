// Every inline <script> on the site's pages must at least parse. A typo here takes the whole site down.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
for (const page of ["index.html", "raffle/index.html", "seamstress/index.html"]) {
  test(page + " scripts parse", async () => {
    const html = await readFile(new URL("../" + page, import.meta.url), "utf8");
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(scripts.length);
    scripts.forEach((src, i) => assert.doesNotThrow(() => new Function(src), "script " + i + " in " + page));
  });
}
