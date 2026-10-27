#!/usr/bin/env node
// Writes STATUS.md from FEATURES.md: what is built, partly built, still to do, and proposed.
// FEATURES.md stays the single source of truth; run `pnpm status` after changing a status there.
import { readFileSync, writeFileSync } from "node:fs";

const ROW = /^\| ([A-Z]+-\d+) \| (P\d) \| ([^|]+)\| (build|partial|todo|proposed) \| (.+?) \|\s*$/;
const LABELS = { build: "Built", partial: "Partly built", todo: "To do", proposed: "Proposed (not in the brief yet)" };

export function readFeatures(text) {
  const rows = [];
  let section = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) section = line.slice(3).trim();
    const m = ROW.exec(line);
    if (m) rows.push({ id: m[1], priority: m[2], screen: m[3].trim(), status: m[4], text: m[5].trim(), section });
  }
  return rows;
}

export function render(rows, date) {
  const by = (s) => rows.filter((r) => r.status === s);
  const out = [`# Status`, ``, `Generated from FEATURES.md on ${date} by \`pnpm status\`. Edit FEATURES.md, not this file.`, ``];
  out.push(`| Status | Count |`, `|---|---|`);
  for (const s of Object.keys(LABELS)) out.push(`| ${LABELS[s]} | ${by(s).length} |`);
  out.push(`| Total | ${rows.length} |`, ``);
  for (const s of ["partial", "todo", "proposed"]) {
    const list = by(s);
    if (!list.length) continue;
    out.push(`## ${LABELS[s]}`, ``);
    for (const r of list) out.push(`- **${r.id}** (${r.priority}, ${r.section}): ${r.text.replace(/\.\.\.$/, "").slice(0, 160)}`);
    out.push(``);
  }
  out.push(`## Built, by section`, ``);
  const sections = [...new Set(by("build").map((r) => r.section))];
  for (const section of sections) out.push(`- ${section}: ${by("build").filter((r) => r.section === section).map((r) => r.id).join(", ")}`);
  out.push(``);
  return out.join("\n");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1:")}` || process.argv[1]?.endsWith("status.mjs")) {
  const rows = readFeatures(readFileSync("FEATURES.md", "utf8"));
  writeFileSync("STATUS.md", render(rows, new Date().toISOString().slice(0, 10)));
  const counts = Object.fromEntries(Object.keys(LABELS).map((s) => [s, rows.filter((r) => r.status === s).length]));
  console.log(`STATUS.md: ${rows.length} features`, counts);
}
