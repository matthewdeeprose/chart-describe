// A chart author can type anything into a title or a label. These tests put markup into those strings
// and check that every output form treats it as plain text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const lib = require("./load.cjs");

const HOSTILE = '<script>alert(1)</script> & "q"';
const ESCAPED_TAG = "&lt;script&gt;alert(1)&lt;/script&gt;";

const golden = (family) => JSON.parse(readFileSync(new URL(`./goldens/${family}.json`, import.meta.url), "utf8"));
const firstInput = (family) => lib.decodeArgs(golden(family).find((entry) => !entry.synthetic).args);

// The three charts, each with the hostile string in its title and in one more author field.
function charts() {
  const [radarFacts] = firstInput("radar");
  radarFacts.title = HOSTILE;
  radarFacts.axes[0].label = HOSTILE;
  radarFacts.curves[0].label = HOSTILE;
  radarFacts.tabled[0].label = HOSTILE;
  radarFacts.compared[0].label = HOSTILE;

  const [xyChart] = firstInput("xychart");
  xyChart.title = HOSTILE;
  xyChart.xAxis.categories[0] = HOSTILE;

  return {
    pie: lib.charts.buildPieModel(HOSTILE, [
      { name: HOSTILE, value: 2 },
      { name: "A&B", value: 1 },
    ]),
    radar: lib.charts.buildRadarModel(radarFacts),
    xychart: lib.charts.buildXychartModel(xyChart),
  };
}

for (const [family, model] of Object.entries(charts())) {
  test(`${family}: HTML escapes an author string, in the short and the detailed form`, () => {
    const html = lib.render.renderHtml(model, lib.render.PROFILES.lines);
    for (const form of [html.shortHTML, html.detailed]) {
      assert.ok(!form.includes("<script>"), "no raw script tag");
      assert.ok(form.includes(ESCAPED_TAG), "the tag is escaped");
      assert.ok(!form.includes("&amp;lt;"), "nothing is escaped twice");
    }
    assert.ok(html.shortHTML.includes("&quot;q&quot;"), "quotation marks are escaped in the short form");
  });

  test(`${family}: Markdown does not let an author string open a tag`, () => {
    const markdown = lib.render.renderMarkdown(model);
    for (const form of [markdown.short, markdown.detailed]) {
      assert.ok(form.includes("\\<script>"), "the opening angle bracket carries a backslash");
      assert.ok(!/(^|[^\\])<script>/.test(form), "no unescaped script tag");
    }
  });

  test(`${family}: the plain text keeps the author's words as they were typed`, () => {
    const text = lib.render.renderText(model);
    assert.ok(text.short.includes(HOSTILE) || text.detailed.includes(HOSTILE), "the raw string appears in the plain text");
  });
}

test("pie: the sections layout escapes an author string", () => {
  const composed = lib.chartjs.composePie(HOSTILE, [
    { name: HOSTILE, value: 2 },
    { name: "A&B", value: 1 },
  ]);
  for (const form of [composed.shortHTML, composed.detailed]) {
    assert.ok(!form.includes("<script>"), "no raw script tag");
    assert.ok(form.includes(ESCAPED_TAG), "the tag is escaped");
  }
});
