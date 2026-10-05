#!/usr/bin/env node
/**
 * Post-build protection pass. Runs after `next build`.
 *
 * 1. Tripwire: fails the build if any Discord snowflake or source-map
 *    reference reaches the client output. Secrets belong in the `server-only`
 *    modules under `lib/`; this enforces that rule rather than trusting it.
 *
 * 2. Obfuscation: applied only to this app's own chunks. Vendor and framework
 *    chunks (React, Next runtime, core-js polyfills) are identified from
 *    `.next/build-manifest.json` and skipped. Obfuscating React buys nothing
 *    and inflates the bundle by well over its size, because control-flow
 *    flattening rewrites every function body.
 *
 * Honest scope: this raises the cost of reading the shipped bundle. It is not
 * a security boundary. The browser already holds the bytes and a determined
 * reader always wins. Real defences here are the server-only member table,
 * minified framework code, and never publishing source maps.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/+$/, "");
const OUT_DIR = join(ROOT, ".next");
const BUILD_MANIFEST = join(OUT_DIR, "build-manifest.json");

/** 17-20 digit runs: Discord snowflake shape. */
const SNOWFLAKE = /(?<![\w.])(\d{17,20})(?![\w.])/g;
const SOURCE_MAP_REF = /sourceMappingURL/g;

const MEMBER_TABLE = join(ROOT, "lib/member-table.server.ts");

/**
 * Stamped into every chunk this script writes, so a repeat run recognises its
 * own output instead of obfuscating it a second time. Must stay a comment: a
 * bare identifier would be evaluated at load and throw ReferenceError.
 */
const MARKER = "__wds_protect_1__";
const MARKER_PROBE = `/*${MARKER}*/`;

/**
 * The one thing that must never reach a client: the member table.
 *
 * Read straight from the server-only module so the tripwire cannot drift out
 * of sync with the real list. Note this deliberately does not flag every
 * 17-20 digit run in the output: Discord application IDs, emoji IDs and the
 * audio filename's digits are public data that any visitor's browser sees
 * regardless, and pretending otherwise would train this check to be ignored.
 */
async function loadMemberIds() {
  try {
    const source = await readFile(MEMBER_TABLE, "utf8");
    return [...new Set(source.match(SNOWFLAKE) ?? [])];
  } catch {
    console.error("protect: cannot read lib/member-table.server.ts");
    process.exit(1);
  }
}

/**
 * Chunks Next preloads for every route: framework, never our code. Names come
 * from the build manifest, content from markers that survive minification.
 */
const FRAMEWORK_MARKERS = [
  "react-dom",
  "react.production",
  "Minified React error",
  "createFromReadableStream",
  "next/dist/",
  "useRouterBFCache",
  "core-js",
  "which-typed-array",
  // core-js / regenerator-runtime polyfill prologue.
  'typeof globalThis&&globalThis',
];

/**
 * Safety invariant. Our own code is a small fraction of the client bundle;
 * if classification ever drifts and React gets obfuscated, control-flow
 * flattening inflates it by several times its size. Refuse rather than ship
 * a bloated, half-protected bundle.
 */
const MAX_APP_SHARE = 0.4;

function isClientChunk(file) {
  if (extname(file) !== ".js") return false;
  const rel = relative(OUT_DIR, file).split("\\").join("/");
  if (rel.startsWith("static/chunks/")) return true;
  if (rel.startsWith("app/") && !rel.includes("/server/")) return true;
  return false;
}

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

/** Framework chunks, by name (from the build manifest) and by content. */
async function loadFrameworkSet() {
  const names = new Set();
  try {
    const manifest = JSON.parse(await readFile(BUILD_MANIFEST, "utf8"));
    for (const entry of [
      ...(manifest.rootMainFiles ?? []),
      ...Object.values(manifest.pages ?? {}).flat(),
    ]) {
      names.add(basename(entry));
    }
  } catch {
    // No manifest: fall back to content markers only.
  }
  return names;
}

function isFramework(file, source, frameworkNames) {
  if (frameworkNames.has(basename(file))) return true;
  // core-js / regenerator-runtime polyfill prologue, before Turbopack's wrapper.
  if (/^\s*!function\(\)\{var [a-z]+="undefined"!=typeof/.test(source)) return true;
  const head = source.slice(0, 6000);
  return FRAMEWORK_MARKERS.some((marker) => head.includes(marker));
}

async function main() {
  const chunks = [];
  for await (const file of walk(OUT_DIR)) {
    if (isClientChunk(file)) chunks.push(file);
  }

  if (chunks.length === 0) {
    console.error("protect: no client chunks found under .next. Run `next build` first.");
    process.exit(1);
  }

  // --- 1. tripwire -------------------------------------------------------
  const memberIds = await loadMemberIds();
  const leaks = [];
  const mapRefs = [];

  for (const file of chunks) {
    const source = await readFile(file, "utf8");
    const found = memberIds.filter((id) => source.includes(id));
    if (found.length > 0) {
      leaks.push(`${relative(ROOT, file)}: ${found.slice(0, 5).join(", ")}`);
    }
    if (SOURCE_MAP_REF.test(source)) mapRefs.push(relative(ROOT, file));
  }

  if (leaks.length > 0) {
    console.error("protect: member table leaked into client output, refusing to finish:");
    for (const leak of leaks) console.error(`  ${leak}`);
    process.exit(1);
  }
  if (mapRefs.length > 0) {
    console.error("protect: sourceMappingURL in client output, refusing to finish:");
    for (const ref of mapRefs) console.error(`  ${ref}`);
    process.exit(1);
  }

  // The prerendered HTML travels to every visitor too. Next names the page
  // file after its route segment (`app/index.html`), not after the page
  // component, so scan the whole server output rather than guessing a name.
  let htmlScanned = 0;
  for await (const file of walk(join(OUT_DIR, "server"))) {
    if (extname(file) !== ".html") continue;
    const source = await readFile(file, "utf8");
    htmlScanned++;
    const found = memberIds.filter((id) => source.includes(id));
    if (found.length > 0) {
      console.error(
        `protect: member table leaked into prerendered ${relative(ROOT, file)}, ` +
          `refusing to finish: ${found.slice(0, 5).join(", ")}`,
      );
      process.exit(1);
    }
  }

  if (htmlScanned === 0) {
    console.error(
      "protect: no prerendered HTML found to scan. The member-table tripwire " +
        "cannot verify the page payload, refusing to claim coverage.",
    );
    process.exit(1);
  }

  // --- 2. obfuscate app chunks only -------------------------------------
  // Obfuscation is not idempotent: a second pass over an already-obfuscated
  // chunk inflates it further. Vercel can restore `.next` from its build cache
  // and re-run this script, so skip any chunk this script already wrote.
  const frameworkNames = await loadFrameworkSet();
  const { default: JavaScriptObfuscator } = await import("javascript-obfuscator");

  let obfuscated = 0;
  let skipped = 0;
  let alreadyDone = 0;
  let before = 0;
  let after = 0;
  let totalBytes = 0;
  const appChunks = [];

  for (const file of chunks) {
    const original = await readFile(file, "utf8");
    totalBytes += original.length;

    if (isFramework(file, original, frameworkNames)) {
      skipped++;
      continue;
    }

    if (original.includes(MARKER_PROBE)) {
      alreadyDone++;
      continue;
    }

    appChunks.push(file);
    before += original.length;

    // Identifier mangling plus a base64 string array: every literal (glyph
    // sets, URLs, status keys, CSS ids) is moved into one decoded array and
    // referenced by offset, so a scraper cannot grep the chunk for content.
    //
    // Control-flow flattening was benchmarked and rejected: on this chunk it
    // added ~35kB for no readable benefit over the string array alone.
    const result = JavaScriptObfuscator.obfuscate(original, {
      compact: true,
      target: "browser",
      simplify: true,
      identifierNamesGenerator: "mangled",
      renameGlobals: false,
      controlFlowFlattening: false,
      stringArray: true,
      stringArrayThreshold: 0.8,
      stringArrayWrappersCount: 2,
      stringArrayEncoding: ["base64"],
      splitStrings: true,
      splitStringsChunkLength: 12,
      simplifyFlow: true,
      deadCodeInjection: false,
      selfDefending: false,
      debugProtection: false,
      disableConsoleOutput: false,
      seed: 0x5744,
    });

    const output = `${MARKER_PROBE}${result.getObfuscatedCode()}`;
    await writeFile(file, output, "utf8");
    after += output.length;
    obfuscated++;
  }

  if (alreadyDone > 0) {
    console.log(
      `protect: ${alreadyDone} chunk(s) already protected, left untouched (idempotency guard)`,
    );
  }

  const share = totalBytes > 0 ? before / totalBytes : 0;
  if (appChunks.length === 0 && alreadyDone > 0) {
    console.log("protect: nothing left to obfuscate.");
    return;
  }
  if (appChunks.length === 0) {
    console.error("protect: no app chunk identified, obfuscation would do nothing.");
    process.exit(1);
  }
  if (share > MAX_APP_SHARE) {
    console.error(
      `protect: app chunks are ${(share * 100).toFixed(0)}% of the client bundle, ` +
        `expected under ${(MAX_APP_SHARE * 100).toFixed(0)}%. Framework code was ` +
        `probably misclassified as app code; refusing to obfuscate it.`,
    );
    process.exit(1);
  }

  const pct = before > 0 ? (((before - after) / before) * 100).toFixed(1) : "0.0";

  console.log(
    `protect: scanned ${chunks.length} chunk(s) + prerendered HTML: ` +
      `${memberIds.length} member IDs absent, 0 source maps`,
  );
  console.log(`protect: obfuscated ${obfuscated} app chunk(s), skipped ${skipped} framework chunk(s)`);
  console.log(
    `protect: app code ${(before / 1024).toFixed(0)}kB -> ${(after / 1024).toFixed(0)}kB (${pct}% delta)`,
  );
  for (const file of appChunks) console.log(`protect:   hardened ${relative(ROOT, file)}`);
}

main().catch((error) => {
  console.error("protect: failed", error);
  process.exit(1);
});