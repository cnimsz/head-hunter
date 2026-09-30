#!/usr/bin/env node
// funding-status installer — adds the shared credits pill to a project.
//
// Usage (from the project root, after copying this folder in as ./funding-status):
//   node funding-status/install.mjs              install / update (safe to re-run)
//   node funding-status/install.mjs --dry-run    show what would change, write nothing
//   node funding-status/install.mjs --uninstall  remove everything it added
//   node funding-status/install.mjs --root <dir> project root (default: this folder's parent)
//
// What it does:
//   1. Inlines the <funding-status> component into your HTML page(s) — no
//      separate asset, so it works on any route or base path, with no build step.
//   2. Places the pill in the page's <header> (or at the top of <body>).
//   3. Copies the server helper (report-usage.js + .d.ts) into your source tree
//      so your backend can report Anthropic spend into the shared credit pool.
// Everything it writes sits between `funding-status:*` markers, so re-running
// replaces it cleanly and --uninstall removes it.
//
// No dependencies. Node 18+.

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const UNINSTALL = args.includes('--uninstall');
const rootIdx = args.indexOf('--root');
const ROOT = resolve(rootIdx >= 0 && args[rootIdx + 1] ? args[rootIdx + 1] : join(HERE, '..'));

const PROJECT_NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const HTML_CANDIDATES = ['public/index.html', 'index.html', 'static/index.html', 'src/index.html', 'www/index.html'];
const SCRIPT_START = '<!-- funding-status:script:start -->';
const SCRIPT_END = '<!-- funding-status:script:end -->';
const TAG_START = '<!-- funding-status:tag:start -->';
const TAG_END = '<!-- funding-status:tag:end -->';

const log = (msg = '') => console.log(msg);
const rel = (p) => relative(ROOT, p) || '.';
function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- config ---
const configPath = join(HERE, 'funding-status.config.json');
if (!existsSync(configPath)) fail(`Missing ${rel(configPath)}`);
let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (e) {
  fail(`${rel(configPath)} is not valid JSON: ${e.message}`);
}

function projectName() {
  if (config.project) return config.project;
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    return String(pkg.name || '')
      .replace(/^@[^/]+\//, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  } catch {
    return '';
  }
}

// ----------------------------------------------------------------- html ---
const escapeAttr = (v) =>
  String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function stripBlock(html, start, end) {
  const re = new RegExp(`[ \\t]*${escapeRe(start)}[\\s\\S]*?${escapeRe(end)}[ \\t]*\\r?\\n?`, 'g');
  return html.replace(re, '');
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function indentOf(html, index) {
  const lineStart = html.lastIndexOf('\n', index - 1) + 1;
  return (html.slice(lineStart, index).match(/^[ \t]*/) || [''])[0];
}

function buildScriptBlock(indent) {
  const component = readFileSync(join(HERE, 'funding-status.js'), 'utf8');
  if (/<\/script/i.test(component)) fail('funding-status.js contains "</script" and cannot be inlined');
  return [
    `${indent}${SCRIPT_START}`,
    `${indent}<!-- Shared credits pill. Managed by funding-status/install.mjs — edit funding-status.config.json and re-run instead of editing here. -->`,
    `${indent}<script type="module">`,
    component.trimEnd(),
    `${indent}</script>`,
    `${indent}${SCRIPT_END}`,
    ''
  ].join('\n');
}

function buildTagBlock(indent, project) {
  const attrs = {
    project,
    'supabase-url': config.supabaseUrl,
    'anon-key': config.anonKey,
    'donate-url': config.donateUrl,
    tagline: config.tagline,
    'cta-text': config.ctaText,
    'empty-text': config.emptyText,
    'thanks-text': config.thanksText,
    notify: config.notify,
    theme: config.theme
  };
  const lines = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${indent}  ${k}="${escapeAttr(v)}"`);
  return [`${indent}${TAG_START}`, `${indent}<funding-status`, ...lines, `${indent}></funding-status>`, `${indent}${TAG_END}`, ''].join('\n');
}

function installInto(file, project) {
  const original = readFileSync(file, 'utf8');
  let html = stripBlock(stripBlock(original, SCRIPT_START, SCRIPT_END), TAG_START, TAG_END);
  if (UNINSTALL) return { html, original, where: 'removed' };

  const headClose = html.search(/<\/head>/i);
  if (headClose < 0) fail(`${rel(file)} has no </head> — cannot place the component script`);
  const scriptIndent = indentOf(html, headClose) + '  ';
  html = html.slice(0, headClose) + buildScriptBlock(scriptIndent) + indentOf(html, headClose) + html.slice(headClose).replace(/^[ \t]*/, '');

  let where;
  const headerClose = html.search(/<\/header>/i);
  if (headerClose >= 0) {
    const ind = indentOf(html, headerClose) + '  ';
    html = html.slice(0, headerClose) + buildTagBlock(ind, project) + indentOf(html, headerClose) + html.slice(headerClose).replace(/^[ \t]*/, '');
    where = 'end of <header>';
  } else {
    const bodyOpen = html.match(/<body[^>]*>\r?\n?/i);
    if (!bodyOpen) fail(`${rel(file)} has no <body> — cannot place the pill`);
    const at = bodyOpen.index + bodyOpen[0].length;
    html = html.slice(0, at) + buildTagBlock('    ', project) + html.slice(at);
    where = 'top of <body>';
  }
  return { html, original, where };
}

// --------------------------------------------------------------- server ---
function serverHelperTarget() {
  if (config.serverHelperDir) return resolve(ROOT, config.serverHelperDir);
  if (existsSync(join(ROOT, 'src'))) return join(ROOT, 'src', 'funding-status');
  return null;
}

// ------------------------------------------------------------------ run ---
log(`\nfunding-status ${UNINSTALL ? 'uninstall' : 'install'}${DRY ? ' (dry run)' : ''} — project root: ${ROOT}`);

const project = projectName();
if (!UNINSTALL) {
  const donate = String(config.donateUrl || '');
  if (!/^https:\/\/\S+$/.test(donate) || /REPLACE/i.test(donate)) {
    fail(
      `Set "donateUrl" in ${rel(configPath)} to this project's Stripe Payment Link\n` +
        `  (e.g. https://donate.stripe.com/xxxx or https://buy.stripe.com/xxxx), then re-run.`
    );
  }
  if (!PROJECT_NAME_RE.test(project)) {
    fail(
      `Couldn't derive a valid project name (got "${project}").\n` +
        `  Set "project" in ${rel(configPath)} — lowercase letters, digits and dashes,\n` +
        `  and it must match the name used in the USAGE_REPORT_KEYS Supabase secret.`
    );
  }
  log(`  project name: ${project}`);
}

const htmlFiles = (config.htmlFiles && config.htmlFiles.length ? config.htmlFiles : HTML_CANDIDATES.filter((p) => existsSync(join(ROOT, p))).slice(0, 1)).map((p) =>
  resolve(ROOT, p)
);
if (!htmlFiles.length) {
  fail(`No HTML page found (looked for ${HTML_CANDIDATES.join(', ')}).\n  Set "htmlFiles" in ${rel(configPath)}.`);
}

for (const file of htmlFiles) {
  if (!existsSync(file)) fail(`HTML file not found: ${rel(file)}`);
  const { html, original, where } = installInto(file, project);
  if (html === original) {
    log(`  ${rel(file)}: no change`);
  } else {
    if (!DRY) writeFileSync(file, html);
    log(`  ${rel(file)}: ${UNINSTALL ? 'pill removed' : `pill added (${where}), component inlined in <head>`}`);
  }
}

const helperDir = serverHelperTarget();
const helperFiles = ['report-usage.js', 'report-usage.d.ts'];
if (helperDir) {
  if (UNINSTALL) {
    if (existsSync(helperDir)) {
      if (!DRY) rmSync(helperDir, { recursive: true, force: true });
      log(`  ${rel(helperDir)}/: removed`);
    }
  } else {
    if (!DRY) mkdirSync(helperDir, { recursive: true });
    for (const f of helperFiles) {
      if (!DRY) copyFileSync(join(HERE, f), join(helperDir, f));
    }
    log(`  ${rel(helperDir)}/: server helper copied (${helperFiles.join(', ')})`);
  }
} else if (!UNINSTALL) {
  log('  (no src/ folder and no "serverHelperDir" set — server helper not copied)');
}

if (UNINSTALL) {
  log('\n✓ Removed. Also undo the backend hook and remove the USAGE_REPORT_KEY secret if you added them.\n');
  process.exit(0);
}

const importPath = helperDir ? `./${relative(ROOT, join(helperDir, 'report-usage.js')).replace(/\\/g, '/')}` : './funding-status/report-usage.js';
log(`
✓ Pill installed${DRY ? ' (dry run — nothing written)' : ''}. It reads the shared balance live; nothing else is needed for it to show.

Remaining one-time steps (see funding-status/INSTALL.md for details):

  1. Report this project's Anthropic spend — after every Anthropic call, in the backend:
       import { configureUsageReporting, reportUsageRecord } from "${importPath}";
       configureUsageReporting({ projectKey: env.USAGE_REPORT_KEY });   // once, at startup
       await reportUsageRecord({ model, input_tokens, output_tokens,
         cache_creation_input_tokens, cache_read_input_tokens, web_search_requests, batch });

  2. Give the backend its key (the same one registered as "${project}:<key>" in USAGE_REPORT_KEYS):
       Cloudflare Worker:  npx wrangler secret put USAGE_REPORT_KEY
       Local / Node CLI:   set USAGE_REPORT_KEY in the shell or .dev.vars

  3. In Stripe, set this Payment Link's after-payment redirect to
       https://<this-site>/?donated=1   (shows the thank-you notice)
`);
