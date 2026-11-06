// These tests pin two wording rules of the bar and line chart describer.
// 1. A titled x-axis keeps the neutral noun "categories", unless the title names the kind of label.
// 2. A line series that turns once reads "rises, then falls" (or "falls, then rises").
// Each test builds a chart and checks the exact sentence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lib = require("./load.cjs");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const band = (title, categories) => ({ kind: "band", title, categories });
const line = (name, values) => ({ kind: "line", name, values });
const bar = (name, values) => ({ kind: "bar", name, values });
const chart = (xAxis, series) => ({
  type: "xychart",
  title: null,
  accTitle: "",
  accDescr: "",
  orientation: "vertical",
  xAxis,
  yAxis: null,
  series,
});

// Builds the chart and returns the short sentence and the lines of the detailed text.
function describe(input) {
  const built = lib.charts.buildXychartModel(JSON.parse(JSON.stringify(input)));
  const html = lib.render.renderHtml(built, lib.render.PROFILES.lines);
  return {
    short: lib.model.flatten(built.short),
    shortHTML: html.shortHTML,
    lines: lib.render.renderText(built).detailed.split("\n"),
  };
}

// ---- Rule 1: the noun under a titled x-axis ----

const NOUN_ROWS = [
  {
    name: '"Month" over Jan to Jun says six months',
    input: chart(band("Month", MONTHS), [line("Visits", [820, 910, 1040, 980, 760, 640])]),
    axis: 'The x-axis, "Month", lists six months.',
    shortStart: 'A line chart showing "Visits" over six months. ',
  },
  {
    name: '"Quarter" over Q1 to Q4 says four quarters',
    input: chart(band("Quarter", ["Q1", "Q2", "Q3", "Q4"]), [line("Visits", [10, 12, 9, 14])]),
    axis: 'The x-axis, "Quarter", lists four quarters.',
    shortStart: 'A line chart showing "Visits" over four quarters. ',
  },
  {
    name: '"Academic year" over split years says three years',
    input: chart(band("Academic year", ["2021/22", "2022/23", "2023/24"]), [line("Students", [90, 110, 105])]),
    axis: 'The x-axis, "Academic year", lists three years.',
    shortStart: 'A line chart showing "Students" over three years. ',
  },
  {
    name: '"Monthly figures" over Jan to Jun says six months',
    input: chart(band("Monthly figures", MONTHS), [line("Visits", [5, 6, 7, 8, 9, 10])]),
    axis: 'The x-axis, "Monthly figures", lists six months.',
    shortStart: 'A line chart showing "Visits" over six months. ',
  },
  {
    name: '"Month" over one label says one month',
    input: chart(band("Month", ["Jan"]), [line("Visits", [5])]),
    axis: 'The x-axis, "Month", lists one month.',
    shortStart: 'A line chart showing "Visits" over one month. ',
  },
  {
    name: '"Team member" over April to June keeps categories',
    input: chart(band("Team member", ["April", "May", "June"]), [bar("Tasks done", [8, 11, 6])]),
    axis: 'The x-axis, "Team member", lists three categories.',
    shortStart: 'A bar chart showing "Tasks done" for three categories. ',
  },
  {
    name: '"Quarter" over Jan, Apr, Jul, Oct keeps categories',
    input: chart(band("Quarter", ["Jan", "Apr", "Jul", "Oct"]), [line("Visits", [10, 12, 9, 14])]),
    axis: 'The x-axis, "Quarter", lists four categories.',
    shortStart: 'A line chart showing "Visits" over four categories. ',
  },
  {
    name: '"Period" over labels the detector cannot type keeps categories',
    input: chart(band("Period", ["Jan", "Feb", "Total"]), [line("Visits", [5, 6, 11])]),
    axis: 'The x-axis, "Period", lists three categories.',
    shortStart: 'A line chart showing "Visits" over three categories. ',
  },
];

for (const row of NOUN_ROWS) {
  test(`noun: ${row.name}`, () => {
    const result = describe(row.input);
    assert.ok(result.lines.includes(row.axis), `axis line: ${row.axis}`);
    assert.ok(result.short.startsWith(row.shortStart), `short sentence starts: ${row.shortStart}`);
  });
}

test("noun: untitled month labels still say months", () => {
  const result = describe(chart(band(null, MONTHS), [line("Visits", [5, 6, 7, 8, 9, 10])]));
  assert.ok(result.lines.includes("Months are plotted on the x-axis."));
  assert.ok(result.short.startsWith('A line chart showing "Visits" over six months. '));
});

// ---- Rule 2: a series that turns once ----

test("turn: 820, 910, 1040, 980, 760, 640 says rises, then falls in the bullet and names March in the short sentence", () => {
  const result = describe(chart(band(null, MONTHS), [line("Main library", [820, 910, 1040, 980, 760, 640])]));
  assert.equal(
    result.short,
    'A line chart showing "Main library" over six months. The "Main library" series rises to a peak at "Mar", then falls, with values between 640 and 1040.',
  );
  assert.ok(result.lines.includes('• The "Main library" series rises, then falls.'));
  assert.ok(!result.lines.some((text) => text.includes("generally decreasing")));
});

test("turn: a valley says falls to a low in the short sentence and falls, then rises in the bullet", () => {
  const result = describe(chart(band(null, MONTHS), [line("Rainfall", [830, 790, 700, 610, 690, 820])]));
  assert.equal(
    result.short,
    'A line chart showing "Rainfall" over six months. The "Rainfall" series falls to a low at "Apr", then rises, with values between 610 and 830.',
  );
  assert.ok(result.lines.includes('• The "Rainfall" series falls, then rises.'));
});

test("turn: a flat top names both months", () => {
  const result = describe(chart(band(null, MONTHS), [line("Visits", [10, 20, 30, 30, 20, 15])]));
  assert.ok(
    result.short.includes('The "Visits" series rises to a peak at "Mar" and "Apr", then falls, with values between 10 and 30.'),
  );
  assert.ok(result.lines.includes('• The "Visits" series rises, then falls.'));
});

test("turn: a step back of 7.5% of the range is still one hill", () => {
  const result = describe(chart(band(null, MONTHS), [line("Visits", [110, 135, 132, 150, 130, 112])]));
  assert.ok(result.short.includes('rises to a peak at "Apr", then falls'));
  assert.ok(result.lines.includes('• The "Visits" series rises, then falls.'));
});

test("turn: a step back of 14% of the range is not one hill, and the old wording stays", () => {
  const result = describe(chart(band(null, MONTHS), [line("Visits", [110, 130, 125, 145, 140, 120])]));
  assert.ok(result.short.includes('The "Visits" series is generally increasing with fluctuations, with values between 110 and 145.'));
  assert.ok(result.lines.includes('• The "Visits" series shows a generally increasing trend, with fluctuations.'));
});

test("turn: two humps keep the old wording", () => {
  const result = describe(chart(band(null, MONTHS), [line("Visits", [110, 140, 115, 145, 112, 130])]));
  assert.ok(result.short.includes("is generally increasing with fluctuations"));
  assert.ok(result.lines.includes('• The "Visits" series shows a generally increasing trend, with fluctuations.'));
});

test("turn: a symmetric hill (5, 10, 15, 10, 5) no longer reads as no clear trend", () => {
  const result = describe(chart(band(null, ["Mon", "Tue", "Wed", "Thu", "Fri"]), [line("Visits", [5, 10, 15, 10, 5])]));
  assert.ok(result.lines.includes('• The "Visits" series rises, then falls.'));
  assert.ok(!result.lines.some((text) => text.includes("no clear trend")));
});

test("turn: a symmetric hill with a short sentence of its own names Wednesday", () => {
  const result = describe(chart(band(null, ["Mon", "Tue", "Wed", "Thu", "Fri"]), [line("Visits", [105, 110, 115, 110, 105])]));
  assert.ok(result.short.includes('The "Visits" series rises to a peak at "Wed", then falls, with values between 105 and 115.'));
});

test("turn: a series that rises most of the way still says consistently", () => {
  const result = describe(chart(band(null, MONTHS), [line("Visits", [5, 6, 7, 8, 9, 10])]));
  assert.ok(result.lines.includes('• The "Visits" series shows a consistently increasing trend, ranging from 5 to 10.'));
  assert.ok(!result.lines.includes('• The "Visits" series shows a consistently increasing trend.'), "the trend is not repeated");
});

test("turn: with two series the bullets say rises, then falls and the short sentence stays free of a trend", () => {
  const result = describe(
    chart(band(null, MONTHS), [line("Main", [820, 910, 1040, 980, 760, 640]), line("Science", [510, 560, 690, 720, 480, 390])]),
  );
  assert.equal(result.short, 'A line chart over six months. The "Main" series shows the highest overall values.');
  assert.ok(result.lines.includes('• The "Main" series rises, then falls.'));
  assert.ok(result.lines.includes('• The "Science" series rises, then falls.'));
});

test("turn: a label with markup is escaped once in HTML and kept as typed in plain text", () => {
  const hostile = 'Tom & "Jerry" <b>x</b>';
  const result = describe(chart(band(null, ["Jan", hostile, "Mar", "Apr"]), [line("Visits", [100, 140, 110, 90])]));
  assert.ok(result.short.includes(`rises to a peak at "${hostile}", then falls`));
  assert.ok(
    result.shortHTML.includes("rises to a peak at &quot;Tom &amp; &quot;Jerry&quot; &lt;b&gt;x&lt;/b&gt;&quot;, then falls"),
  );
  assert.ok(!result.shortHTML.includes("<b>"), "no raw tag");
  assert.ok(!result.shortHTML.includes("&amp;amp;"), "nothing is escaped twice");
});
