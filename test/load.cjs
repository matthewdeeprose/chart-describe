// Loads the nine source files in their documented order and returns their public objects.
// Each file also puts its object on globalThis, because the files find each other there.
"use strict";

const path = require("node:path");

const SRC = path.join(__dirname, "..", "src");
const LOAD_ORDER = [
  "text.js",
  "model.js",
  "render.js",
  "charts-shared.js",
  "charts-xychart.js",
  "charts-pie.js",
  "charts-radar.js",
  "charts.js",
  "chartjs.js",
];

const [text, model, render, shared, xychart, pie, radar, charts, chartjs] = LOAD_ORDER.map((name) =>
  require(path.join(SRC, name)),
);

// The tags below stand for values that JSON cannot hold (NaN, Infinity, -0, undefined) and for
// objects that appear more than once in one call. A golden stores its input this way.
function decode(value, registry = new Map()) {
  if (value === null || typeof value !== "object") return value;
  switch (value.$) {
    case "undefined":
      return undefined;
    case "NaN":
      return NaN;
    case "Infinity":
      return Infinity;
    case "-Infinity":
      return -Infinity;
    case "-0":
      return -0;
    case "ref":
      if (!registry.has(value.id)) throw new Error("dangling ref " + value.id);
      return registry.get(value.id);
    case "array": {
      const list = [];
      registry.set(value.id, list);
      for (const item of value.v) list.push(decode(item, registry));
      return list;
    }
    case "obj": {
      const object = {};
      registry.set(value.id, object);
      for (const key of Object.keys(value.v)) object[key] = decode(value.v[key], registry);
      return object;
    }
    default:
      throw new Error("cannot decode tag " + JSON.stringify(value.$));
  }
}

// Builders change their input, so decode the arguments again for every call.
function decodeArgs(args) {
  const registry = new Map();
  return args.map((arg) => decode(arg, registry));
}

// Runs one entry through the public API and returns every output that entry's tier produces.
// The pie profile is not exported by render.js. chartjs.js defines it and uses it in
// composePie, so pie HTML comes from there.
function runEntry(entry) {
  const args = decodeArgs(entry.args);
  if (entry.family === "pie") {
    const [title, segments] = args;
    const built = charts.buildPieModel(title, segments);
    // buildPieModel sorts its segments in place, so composePie gets a fresh copy.
    const [freshTitle, freshSegments] = decodeArgs(entry.args);
    const composed = chartjs.composePie(freshTitle, freshSegments);
    return collect(entry.kind, built, composed.shortHTML, composed.detailed);
  }
  const built = entry.family === "radar" ? charts.buildRadarModel(args[0]) : charts.buildXychartModel(args[0]);
  const html = render.renderHtml(built, render.PROFILES.lines);
  return collect(entry.kind, built, html.shortHTML, html.detailed);
}

function collect(kind, built, shortHTML, detailedHTML) {
  const plain = render.renderText(built);
  const markdown = render.renderMarkdown(built);
  if (kind === "short") {
    return { short: model.flatten(built.short), shortHTML, textShort: plain.short, markdownShort: markdown.short };
  }
  return { detailedHTML, textDetailed: plain.detailed, markdownDetailed: markdown.detailed };
}

module.exports = { text, model, render, shared, xychart, pie, radar, charts, chartjs, decode, decodeArgs, runEntry, LOAD_ORDER };
