/**
 * augment-eggs.mjs — merges egg-group + hatch-counter data into the baked dex.json.
 *
 * Fetches pokemon-species 1..1025 (PokeAPI with jsDelivr api-data mirror fallback)
 * and adds to each dex entry:
 *   eg — egg group slugs (e.g. ["monster","dragon"]); "no-eggs" = cannot breed
 *   hc — hatch counter (egg cycles); in-game hatch steps = (hc+1)*64
 */
import fs from "node:fs/promises";
import path from "node:path";

const DEX = path.resolve("public/data/dex.json");
const MAX_ID = 1025;
const CONC = 24;

const API = "https://pokeapi.co/api/v2";
const MIRROR = "https://cdn.jsdelivr.net/gh/PokeAPI/api-data@master/data/api/v2";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(ep) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    const url = attempt < 2 ? `${API}/${ep}` : `${MIRROR}/${ep}/index.json`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await sleep(250 * (attempt + 1));
    }
  }
  throw new Error(`${ep}: ${lastErr?.message ?? "failed"}`);
}

async function main() {
  const dex = JSON.parse(await fs.readFile(DEX, "utf8"));
  const byId = new Map(dex.map((e) => [e.id, e]));
  const ids = Array.from({ length: MAX_ID }, (_, i) => i + 1);
  let i = 0, done = 0, failed = 0;
  await Promise.all(
    Array.from({ length: CONC }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= ids.length) break;
        const id = ids[idx];
        try {
          const sp = await getJSON(`pokemon-species/${id}`);
          const e = byId.get(id);
          if (e) {
            e.eg = (sp.egg_groups ?? []).map((g) => g.name);
            e.hc = sp.hatch_counter ?? 20;
          }
        } catch {
          failed++;
        }
        done++;
        if (done % 100 === 0 || done === ids.length)
          console.log(`  species: ${done}/${ids.length} (failed ${failed})`);
      }
    })
  );
  if (failed > 0) {
    console.error(`FAILED: ${failed} species missing egg data — not writing.`);
    process.exit(1);
  }
  await fs.writeFile(DEX, JSON.stringify(dex));
  const st = await fs.stat(DEX);
  console.log(`DONE — dex.json rewritten (${(st.size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error("AUGMENT FAILED:", e);
  process.exit(1);
});
