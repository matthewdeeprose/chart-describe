// These tests pin four wording rules of the pie chart describer.
// 1. "Every value is zero" is said only when every value is zero.
// 2. A pie with a negative value gives no shares, no "largest" and no pattern section.
// 3. The total keeps its fraction when its whole part is twelve digits or more.
// Each test builds a chart and checks the exact sentence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lib = require("./load.cjs");

const NEGATIVE = "Some values are negative, so shares are not given.";
const ZERO = "Every value is zero, so no segment is larger than another.";

// Builds the chart and returns the short sentence and the lines of the detailed text.
function describe(title, pairs) {
  const segments = pairs.map(([name, value]) => ({ name, value }));
  const built = lib.charts.buildPieModel(title, segments);
  const detailed = lib.render.renderText(built).detailed;
  return {
    short: lib.model.flatten(built.short),
    lines: detailed.split("\n"),
    detailed,
  };
}

const insights = (lines) => {
  const start = lines.indexOf("Key Insights") + 2;
  const end = lines.indexOf("Complete Data Points") - 1;
  return lines.slice(start, end);
};

// ---- Rule 1: "Every value is zero" needs every value to be zero ----

test("5 and -5 do not read as all zero", () => {
  const { short, lines } = describe("Net zero", [["Gain", 5], ["Loss", -5]]);
  assert.equal(
    short,
    `A pie chart titled "Net zero" showing the distribution of two categories. ${NEGATIVE}`,
  );
  assert.deepEqual(insights(lines), [`• ${NEGATIVE}`, "• Total: 0"]);
});

test("a pie where every value is zero still says so", () => {
  const { short, lines } = describe("Nothing", [["A", 0], ["B", 0], ["C", 0]]);
  assert.equal(
    short,
    `A pie chart titled "Nothing" showing the distribution of three categories. ${ZERO}`,
  );
  assert.deepEqual(insights(lines), [`• ${ZERO}`, "• Total: 0"]);
});

// ---- Rule 2: a negative value means no shares ----

test("all negative values give no largest segment", () => {
  const { short, lines } = describe("All negative", [["A", -1], ["B", -2]]);
  assert.equal(
    short,
    `A pie chart titled "All negative" showing the distribution of two categories. ${NEGATIVE}`,
  );
  assert.deepEqual(insights(lines), [`• ${NEGATIVE}`, "• Total: -3"]);
  assert.deepEqual(lines.slice(lines.indexOf("Complete Data Points") + 2), ["• A: -1", "• B: -2"]);
});

test("one negative value among positive ones gives no shares and no pattern section", () => {
  const { short, lines, detailed } = describe("Profit and loss", [
    ["Sales", 60],
    ["Refunds", -20],
    ["Other", 10],
  ]);
  assert.equal(
    short,
    `A pie chart titled "Profit and loss" showing the distribution of three categories. ${NEGATIVE}`,
  );
  assert.deepEqual(insights(lines), [`• ${NEGATIVE}`, "• Total: 50"]);
  assert.deepEqual(lines.slice(lines.indexOf("Complete Data Points") + 2), [
    "• Sales: 60",
    "• Other: 10",
    "• Refunds: -20",
  ]);
  assert.ok(!detailed.includes("%"));
  assert.ok(!detailed.includes("Distribution Pattern"));
});

test("a share over a hundred percent is never printed", () => {
  const { short, detailed } = describe("", [["A", 100], ["B", -99]]);
  assert.equal(
    short,
    `A pie chart showing the distribution of two categories. ${NEGATIVE}`,
  );
  assert.ok(!detailed.includes("%"));
});

test("five segments with one negative skip the pattern section", () => {
  const { detailed } = describe("Five", [["A", 50], ["B", 20], ["C", 10], ["D", 5], ["E", -5]]);
  assert.ok(!detailed.includes("Distribution Pattern"));
  assert.ok(!detailed.includes("The bottom"));
});

test("a pie with only non-negative values keeps its shares", () => {
  const { short, lines } = describe("", [["A", 10], ["B", 0]]);
  assert.equal(
    short,
    "A pie chart showing the distribution of two categories. A is the largest segment at 100.0%, representing over half of the total.",
  );
  assert.deepEqual(lines.slice(lines.indexOf("Complete Data Points") + 2), [
    "• A: 10 (100.0%)",
    "• B: 0 (0.0%)",
  ]);
});

// ---- Rule 3: the total keeps its fraction ----

test("a twelve-digit total keeps its decimals", () => {
  const { lines } = describe("", [["A", 123456789012.34], ["B", 0.01]]);
  assert.ok(lines.includes("• Total: 123456789012.35"));
});

test("float noise on a twelve-digit total is still removed", () => {
  const { lines } = describe("", [["A", 123456789012.1], ["B", 0.2]]);
  assert.ok(lines.includes("• Total: 123456789012.3"));
});

test("a total under twelve whole digits is rounded as before", () => {
  const { lines } = describe("", [["A", 0.1], ["B", 0.2], ["C", 0.3]]);
  assert.ok(lines.includes("• Total: 0.6"));
  const eleven = describe("", [["A", 12345678901.5], ["B", 0.1]]);
  assert.ok(eleven.lines.includes("• Total: 12345678901.6"));
});
