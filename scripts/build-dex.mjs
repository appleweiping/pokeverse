/**
 * build-dex.mjs — bakes the complete National Pokédex into static JSON.
 *
 * Sources: PokeAPI (primary) with the PokeAPI/api-data jsDelivr mirror as a
 * fallback so the build also works where pokeapi.co is unreachable.
 *
 * Outputs (public/data):
 *   dex.json       — 1..1025 species: multilingual names/genus, types, base
 *                    stats, height/weight, base exp, growth rate, capture
 *                    rate, evolution edges
 *   moves.json     — every move: multilingual names, type, class, power,
 *                    accuracy, pp, priority, battle meta (ailments, stat
 *                    changes, drain/heal, flinch, crits, multi-hit)
 *   learnsets.json — per species level-up learnset of the newest version group
 *   flavor.json    — multilingual Pokédex flavor text
 *   meta.json      — generation info & counts
 */
import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public/data");
const MAX_ID = 1025;
const CONC = 24;

/** The 24 moves we ship as TMs (classic, battle-relevant picks). */
const TM_MOVES = [
  7, 8, 9, 19, 20, 38, 53, 58, 72, 76, 85, 86,
  89, 91, 92, 94, 116, 156, 157, 164, 182, 188, 247, 332,
];

const API = "https://pokeapi.co/api/v2";
const MIRROR = "https://cdn.jsdelivr.net/gh/PokeAPI/api-data@master/data/api/v2";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(ep) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    // attempts 0-1 hit pokeapi.co, 2-4 hit the jsDelivr mirror
    const url =
      attempt < 2 ? `${API}/${ep}` : `${MIRROR}/${ep}/index.json`;
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

async function pool(items, n, fn, label) {
  const results = new Array(items.length);
  let i = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) break;
        results[idx] = await fn(items[idx], idx);
        done++;
        if (done % 50 === 0 || done === items.length)
          console.log(`  ${label}: ${done}/${items.length}`);
      }
    })
  );
  return results;
}

// NB: PokeAPI language codes are lowercase ("zh-hans", not "zh-Hans")
const LANGS = { "zh-hans": "hans", "zh-hant": "hant", en: "en", ja: "ja", ko: "ko", "ja-hrkt": "jaH" };

function pickNames(entries) {
  const out = {};
  for (const e of entries ?? []) {
    const k = LANGS[e.language?.name];
    if (!k || k === "jaH") continue;
    out[k] = e.name ?? e.genus ?? e.flavor_text;
  }
  // kana fallback for ja
  if (!out.ja) {
    const kana = (entries ?? []).find((e) => e.language?.name === "ja-hrkt");
    if (kana) out.ja = kana.name ?? kana.genus ?? kana.flavor_text;
  }
  return out;
}

const GROWTH = {
  slow: 0,
  medium: 1,
  fast: 2,
  "medium-slow": 3,
  "slow-then-very-fast": 4, // erratic
  "fast-then-very-slow": 5, // fluctuating
};

const STAT_ORDER = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

function idFromUrl(url) {
  const m = /\/(\d+)\/?$/.exec(url);
  return m ? Number(m[1]) : 0;
}

function cleanFlavor(s) {
  return (s ?? "").replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  console.log("== PokéVerse dex baker ==");

  // ---- 1. species + pokemon --------------------------------------------
  const ids = Array.from({ length: MAX_ID }, (_, i) => i + 1);
  const dex = new Array(MAX_ID);
  const learnsets = {};
  const tmsets = {};
  const flavor = {};
  const chainIds = new Set();

  await pool(
    ids,
    CONC,
    async (id) => {
      const [pk, sp] = await Promise.all([
        getJSON(`pokemon/${id}`),
        getJSON(`pokemon-species/${id}`),
      ]);

      // base stats in canonical order
      const stats = STAT_ORDER.map(
        (name) => pk.stats.find((s) => s.stat.name === name)?.base_stat ?? 0
      );
      const types = pk.types
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((t) => t.type.name);

      // newest version-group level-up learnset + TM compatibility
      const byVg = new Map();
      const tmOk = new Set();
      for (const mv of pk.moves) {
        const moveId = idFromUrl(mv.move.url);
        for (const d of mv.version_group_details) {
          const method = d.move_learn_method?.name;
          if (method === "machine" && TM_MOVES.includes(moveId)) tmOk.add(moveId);
          if (method !== "level-up") continue;
          const vg = idFromUrl(d.version_group.url);
          if (!byVg.has(vg)) byVg.set(vg, []);
          byVg.get(vg).push([d.level_learned_at, moveId]);
        }
      }
      if (byVg.size) {
        const newest = Math.max(...byVg.keys());
        learnsets[id] = byVg
          .get(newest)
          .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      } else {
        learnsets[id] = [];
      }
      if (tmOk.size) tmsets[id] = [...tmOk].sort((a, b) => a - b);

      // flavor text: keep the newest entry per language
      const fl = {};
      for (const e of sp.flavor_text_entries ?? []) {
        const k = LANGS[e.language?.name];
        if (!k || k === "jaH") continue;
        fl[k] = cleanFlavor(e.flavor_text);
      }
      if (Object.keys(fl).length) flavor[id] = fl;

      chainIds.add(idFromUrl(sp.evolution_chain?.url ?? ""));

      // abilities: [normalAbilitySlug, ...] then hidden ability last with !prefix
      const abilities = pk.abilities
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((a) => (a.is_hidden ? "!" : "") + a.ability.name);

      // effort-value yield, sparse [[statIdx, n], ...]
      const ey = [];
      STAT_ORDER.forEach((name, i) => {
        const eff = pk.stats.find((s) => s.stat.name === name)?.effort ?? 0;
        if (eff > 0) ey.push([i, eff]);
      });

      dex[id - 1] = {
        id,
        n: pickNames(sp.names),
        g: pickNames(sp.genera),
        t: types,
        s: stats,
        h: pk.height,
        w: pk.weight,
        be: pk.base_experience ?? 0,
        gr: GROWTH[sp.growth_rate?.name] ?? 1,
        cr: sp.capture_rate ?? 45,
        ab: abilities,
        // gender rate: -1 genderless, else female ratio in eighths (0-8)
        gen: sp.gender_rate ?? -1,
        ...(ey.length ? { ey } : {}),
      };
    },
    "pokemon"
  );

  // ---- 2. evolution chains ---------------------------------------------
  const chains = await pool(
    [...chainIds].filter(Boolean),
    CONC,
    (cid) => getJSON(`evolution-chain/${cid}`).catch(() => null),
    "evolution chains"
  );
  const evoMap = {}; // fromSpeciesId -> [{to, how...}]
  function walk(node) {
    if (!node) return;
    const from = idFromUrl(node.species.url);
    for (const next of node.evolves_to ?? []) {
      const to = idFromUrl(next.species.url);
      const d = (next.evolution_details ?? [])[0] ?? {};
      const edge = { to };
      if (d.min_level) edge.lv = d.min_level;
      else if (d.item) edge.item = d.item.name;
      else if (d.trigger?.name === "trade") edge.trade = 1;
      else if (d.min_happiness) edge.hap = d.min_happiness;
      else edge.other = 1;
      if (from <= MAX_ID && to <= MAX_ID) {
        (evoMap[from] ??= []).push(edge);
      }
      walk(next);
    }
  }
  for (const c of chains) walk(c?.chain);
  for (const e of dex) {
    if (e && evoMap[e.id]) e.evo = evoMap[e.id];
  }

  // ---- 3. moves ----------------------------------------------------------
  const list = await getJSON(`move?limit=3000`).catch(() => null);
  let moveIds;
  if (list?.results) {
    moveIds = list.results.map((r) => idFromUrl(r.url)).filter((x) => x > 0 && x < 100000);
  } else {
    moveIds = Array.from({ length: 920 }, (_, i) => i + 1);
  }
  const CLASS = { physical: 0, special: 1, status: 2 };
  const moves = (
    await pool(
      moveIds,
      CONC,
      async (mid) => {
        const m = await getJSON(`move/${mid}`).catch(() => null);
        if (!m) return null;
        const meta = m.meta ?? {};
        const entry = {
          id: m.id,
          n: pickNames(m.names),
          t: m.type?.name ?? "normal",
          c: CLASS[m.damage_class?.name] ?? 2,
          p: m.power ?? 0,
          a: m.accuracy ?? 0, // 0 = never misses
          pp: m.pp ?? 5,
          pr: m.priority ?? 0,
        };
        const mm = {};
        if (meta.ailment && meta.ailment.name !== "none") {
          mm.ail = meta.ailment.name;
          mm.ailCh = meta.ailment_chance || (entry.c === 2 ? 100 : 0);
        }
        if (m.stat_changes?.length) {
          mm.st = m.stat_changes.map((s) => [s.stat.name, s.change]);
          mm.stCh = meta.stat_chance || (entry.c === 2 ? 100 : 0);
        }
        if (meta.drain) mm.drain = meta.drain;
        if (meta.healing) mm.heal = meta.healing;
        if (meta.flinch_chance) mm.flinch = meta.flinch_chance;
        if (meta.crit_rate) mm.crit = meta.crit_rate;
        if (meta.min_hits) mm.hits = [meta.min_hits, meta.max_hits ?? meta.min_hits];
        if (m.target?.name) mm.tgt = m.target.name;
        if (Object.keys(mm).length) entry.m = mm;
        return entry;
      },
      "moves"
    )
  ).filter(Boolean);

  // ---- 4. write -----------------------------------------------------------
  const write = (name, data) =>
    fs.writeFile(path.join(OUT, name), JSON.stringify(data));
  await write("dex.json", dex.filter(Boolean));
  await write("moves.json", moves);
  await write("learnsets.json", learnsets);
  await write("tmsets.json", tmsets);
  await write("flavor.json", flavor);
  await write("meta.json", {
    generatedAt: new Date().toISOString(),
    species: dex.filter(Boolean).length,
    moves: moves.length,
    source: "PokeAPI",
  });

  for (const f of ["dex.json", "moves.json", "learnsets.json", "flavor.json"]) {
    const st = await fs.stat(path.join(OUT, f));
    console.log(`  wrote ${f} (${(st.size / 1024).toFixed(0)} KB)`);
  }
  console.log("DONE");
}

main().catch((e) => {
  console.error("BUILD FAILED:", e);
  process.exit(1);
});
