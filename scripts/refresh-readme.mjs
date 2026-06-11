#!/usr/bin/env node
// Refreshes the live strips in README.md between marker comments.
// No dependencies; runs on Node 20+ (global fetch).

import { readFileSync, writeFileSync } from "node:fs";

const README = new URL("../README.md", import.meta.url).pathname;
const FEED_URL = "https://zakelfassi.com/feed.xml";
const REPOS_URL =
  "https://api.github.com/users/zakelfassi/repos?sort=pushed&per_page=30";

function decode(s) {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .trim();
}

async function fieldNotes() {
  const xml = await (await fetch(FEED_URL)).text();
  const items = [...xml.matchAll(/<item>(.*?)<\/item>/gs)].slice(0, 5);
  return items
    .map(([, item]) => {
      const title = decode(item.match(/<title>(.*?)<\/title>/s)?.[1] ?? "");
      const link = decode(item.match(/<link>(.*?)<\/link>/s)?.[1] ?? "");
      const date = item.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1];
      const day = date ? new Date(date).toISOString().slice(0, 10) : "";
      return `- [${title}](${link}) — ${day}`;
    })
    .join("\n");
}

async function shipping() {
  const headers = { "User-Agent": "zakelfassi-readme-refresh" };
  if (process.env.GITHUB_TOKEN)
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const repos = await (await fetch(REPOS_URL, { headers })).json();
  return repos
    .filter((r) => !r.fork && !r.archived && r.name !== "zakelfassi")
    .slice(0, 5)
    .map(
      (r) =>
        `- [${r.name}](${r.html_url}) — ${r.description ?? ""} *(updated ${r.pushed_at.slice(0, 10)})*`
    )
    .join("\n");
}

function splice(content, marker, body) {
  const start = `<!-- ${marker}:START -->`;
  const end = `<!-- ${marker}:END -->`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}`);
  return content.replace(re, `${start}\n${body}\n${end}`);
}

let readme = readFileSync(README, "utf8");
readme = splice(readme, "FIELD-NOTES", await fieldNotes());
readme = splice(readme, "SHIPPING", await shipping());
writeFileSync(README, readme);
console.log("README refreshed.");
