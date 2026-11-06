// These tests pin the wording rules of the radar chart describer.
// 1. The average of a series is never outside the series' own values. It is the mean rounded to a whole
//    number, unless that lies below the lowest value or above the highest; then one decimal place, then
//    two, and so on, and the first result inside the values is used. Equal values follow the same rule.
//    Each of these tests builds a one-series chart and checks the exact series line.
// 2. An axis whose label is shared with another axis is named with its position, "(axis 2)", in the
//    sentences and in the data table. Labels are compared with white space and invisible format
//    characters stripped from both ends; case and characters inside the label still count.
// 3. An axis label with nothing visible in it (empty, white space, or only format characters such as a
//    zero-width space) reads "unlabelled axis N".
// 4. A comparison with a higher, a lower and an equal part joins them with one "and", before the last.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lib = require("./load.cjs");

// Builds a drawn one-series chart on a scale from 0 to the highest value; returns the series line.
function seriesLine(values) {
  const axes = values.map((_, index) => ({ id: `a${index}`, label: `Axis${index + 1}` }));
  const curve = { id: "t", label: "S", values, drawn: true };
  const facts = {
    title: null,
    axes,
    curves: [curve],
    options: {
      showLegend: true,
      ticks: 5,
      graticule: "circle",
      min: 0,
      max: null,
      scaleMax: Math.max(...values),
      scaleMaxSource: "data",
    },
    N: values.length,
    K: 1,
    noRange: false,
    inverted: false,
    maxUnplotted: false,
    legend: true,
    tabled: [curve],
    compared: [curve],
  };
  const built = lib.charts.buildRadarModel(facts);
  return lib.render.renderText(built).detailed.split("\n").find((line) => line.includes("averaging"));
}

test("0.2, 0.3 and 0.4 average 0.3, not 0", () => {
  // mean 0.3; whole number 0 is below 0.2; one decimal place gives 0.3, inside 0.2 to 0.4
  assert.equal(seriesLine([0.2, 0.3, 0.4]), '1. "S", averaging 0.3. Highest on "Axis3", lowest on "Axis1".');
});

test("0.6, 0.9 and 0.8 average 0.8, not 1", () => {
  // mean 0.7667; whole number 1 is above 0.9; one decimal place gives 0.8, inside 0.6 to 0.9
  assert.equal(seriesLine([0.6, 0.9, 0.8]), '1. "S", averaging 0.8. Highest on "Axis2", lowest on "Axis1".');
});

test("0.6, 0.7 and 0.2 average 0.5, a half that was read as 1", () => {
  // mean 0.5; whole number 1 is above 0.7; one decimal place gives 0.5, inside 0.2 to 0.7
  assert.equal(seriesLine([0.6, 0.7, 0.2]), '1. "S", averaging 0.5. Highest on "Axis2", lowest on "Axis3".');
});

test("0.01, 0.02 and 0.03 need two decimal places", () => {
  // mean 0.02; whole number 0 and one decimal place 0.0 are both below 0.01; two places give 0.02
  assert.equal(seriesLine([0.01, 0.02, 0.03]), '1. "S", averaging 0.02. Highest on "Axis3", lowest on "Axis1".');
});

test("the search reaches the series' own largest number of decimal places and no further", () => {
  // mean 0.03; the values have 2 decimal places, so the search runs 0, 1, 2; whole number 0 and one
  // decimal place 0.0 are both below 0.02; two places give 0.03, inside 0.02 to 0.04
  assert.equal(seriesLine([0.02, 0.03, 0.04]), '1. "S", averaging 0.03. Highest on "Axis3", lowest on "Axis1".');
});

test("decimal places are counted from the number's text, exponent form included", () => {
  // 1e-7, 2e-7 and 3e-7 have 7 decimal places; mean 2e-7; only the 7th place is inside the values
  assert.equal(seriesLine([1e-7, 2e-7, 3e-7]), '1. "S", averaging 2e-7. Highest on "Axis3", lowest on "Axis1".');
});

test("negative values follow the same rule", () => {
  // mean -0.3; whole number 0 is above -0.2; one decimal place gives -0.3, inside -0.4 to -0.2
  assert.equal(seriesLine([-0.4, -0.3, -0.2]), '1. "S", averaging -0.3. Highest on "Axis3", lowest on "Axis1".');
});

test("a whole-number average already inside the values is unchanged", () => {
  // mean 3.33; whole number 3 is inside 2 to 5
  assert.equal(seriesLine([2, 5, 3]), '1. "S", averaging 3. Highest on "Axis2", lowest on "Axis1".');
});

test("halves still round away from zero when the whole number is inside the values", () => {
  // mean 2.5; whole number 3 is inside 2 to 3
  assert.equal(seriesLine([2, 3]), '1. "S", averaging 3. Highest on "Axis2", lowest on "Axis1".');
});

test("equal fractional values average to that value, not 0", () => {
  // mean 0.3; whole number 0 is below 0.3; one decimal place gives 0.3, which is the value
  assert.equal(seriesLine([0.3, 0.3, 0.3]), '1. "S", averaging 0.3. The same value on every axis.');
});

test("equal whole values are unchanged", () => {
  assert.equal(seriesLine([30, 30, 30]), '1. "S", averaging 30. The same value on every axis.');
});

// ---------------------------------------------------------------------------------------------------
// Axis names: repeated labels take their position, blank labels read "unlabelled axis N".

const ZWSP = "​"; // zero-width space, a Unicode format character
const ZWJ = "‍"; // zero-width joiner, a Unicode format character

// Builds a drawn chart from axis labels and [label, values] series and returns the detailed text, line by line.
function radarLines(axisLabels, seriesList) {
  const axes = axisLabels.map((label, index) => ({ id: `a${index}`, label }));
  const curves = seriesList.map(([label, values], index) => ({ id: `c${index}`, label, values, drawn: true }));
  const scaleMax = Math.max(...curves.flatMap((curve) => curve.values));
  const facts = {
    title: null,
    axes,
    curves,
    options: { showLegend: true, ticks: 5, graticule: "circle", min: 0, max: null, scaleMax, scaleMaxSource: "data" },
    N: axes.length,
    K: curves.length,
    noRange: false,
    inverted: false,
    maxUnplotted: false,
    legend: true,
    tabled: curves,
    compared: curves,
  };
  return lib.render.renderText(lib.charts.buildRadarModel(facts)).detailed.split("\n");
}

const axesSentence = (lines) => lines.find((line) => line.startsWith("The axes, clockwise from the top"));
const seriesLines = (lines) => lines.filter((line) => /^\d+\. /.test(line));
const axisBullets = (lines) => lines.filter((line) => line.startsWith("   • "));
const comparisonLines = (lines) => lines.filter((line) => line.includes(" is higher than ") || line.includes(" is lower than "));
const tableRows = (lines) => lines.filter((line) => line.includes(" | "));

const TWO_SUPPLIERS = [
  ["Supplier A", [9, 1, 5]],
  ["Supplier B", [1, 9, 5]],
];

test("two axes with the same label each take their position, in every sentence and in the table", () => {
  const lines = radarLines(["Quality", "Quality", "Cost"], TWO_SUPPLIERS);
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are "Quality" (axis 1), "Quality" (axis 2) and "Cost".');
  assert.deepEqual(seriesLines(lines), [
    '1. "Supplier A", averaging 5. Highest on "Quality" (axis 1), lowest on "Quality" (axis 2).',
    '2. "Supplier B", averaging 5. Highest on "Quality" (axis 2), lowest on "Quality" (axis 1).',
  ]);
  assert.deepEqual(axisBullets(lines), [
    '   • "Quality" (axis 1): 9',
    '   • "Quality" (axis 2): 1',
    '   • "Cost": 5',
    '   • "Quality" (axis 1): 1',
    '   • "Quality" (axis 2): 9',
    '   • "Cost": 5',
  ]);
  assert.deepEqual(comparisonLines(lines), [
    '• "Supplier A" is higher than "Supplier B" on "Quality" (axis 1), lower on "Quality" (axis 2), and equal on "Cost".',
  ]);
  assert.deepEqual(tableRows(lines), [
    "Axis | Supplier A | Supplier B",
    "Quality (axis 1) | 9 | 1",
    "Quality (axis 2) | 1 | 9",
    "Cost | 5 | 5",
  ]);
});

test("axes with different labels carry no position", () => {
  const lines = radarLines(["Speed", "Power", "Skill"], [["Team A", [40, 70, 55]]]);
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are "Speed", "Power" and "Skill".');
  assert.equal(lines.some((line) => line.includes("(axis")), false);
  assert.deepEqual(tableRows(lines), ["Axis | Team A", "Speed | 40", "Power | 70", "Skill | 55"]);
});

test("a trailing space does not make a label different: the two axes are a repeat", () => {
  const lines = radarLines(["Quality ", "Quality", "Cost"], TWO_SUPPLIERS);
  // The label is shown as the author wrote it, trailing space included.
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are "Quality " (axis 1), "Quality" (axis 2) and "Cost".');
  assert.equal(seriesLines(lines)[0], '1. "Supplier A", averaging 5. Highest on "Quality " (axis 1), lowest on "Quality" (axis 2).');
  assert.deepEqual(tableRows(lines).slice(1, 3), ["Quality  (axis 1) | 9 | 1", "Quality (axis 2) | 1 | 9"]);
});

test("a trailing zero-width space does not make a label different: the two axes are a repeat", () => {
  const lines = radarLines([`Quality${ZWSP}`, "Quality", "Cost"], [TWO_SUPPLIERS[0]]);
  assert.equal(
    axesSentence(lines),
    `The axes, clockwise from the top, are "Quality${ZWSP}" (axis 1), "Quality" (axis 2) and "Cost".`,
  );
  assert.deepEqual(tableRows(lines).slice(1, 3), [`Quality${ZWSP} (axis 1) | 9`, "Quality (axis 2) | 1"]);
});

test("a leading space and a trailing joiner do not make labels different either", () => {
  const lines = radarLines([" Quality", `Quality${ZWJ}`, "Cost"], [TWO_SUPPLIERS[0]]);
  assert.equal(
    axesSentence(lines),
    `The axes, clockwise from the top, are " Quality" (axis 1), "Quality${ZWJ}" (axis 2) and "Cost".`,
  );
});

test("labels that differ in case are not a repeat", () => {
  const lines = radarLines(["quality", "Quality", "Cost"], [TWO_SUPPLIERS[0]]);
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are "quality", "Quality" and "Cost".');
  assert.equal(lines.some((line) => line.includes("(axis")), false);
});

test("labels that differ only inside are not a repeat", () => {
  const lines = radarLines(["Quality  x", "Quality x", "Cost"], [TWO_SUPPLIERS[0]]);
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are "Quality  x", "Quality x" and "Cost".');
  assert.equal(lines.some((line) => line.includes("(axis")), false);
});

test("a blank axis beside a repeated one keeps its own name and does not join the repeat", () => {
  const lines = radarLines(["", "Quality", "Quality"], [["S", [3, 7, 5]]]);
  assert.equal(
    axesSentence(lines),
    'The axes, clockwise from the top, are unlabelled axis 1, "Quality" (axis 2) and "Quality" (axis 3).',
  );
  assert.deepEqual(tableRows(lines), ["Axis | S", "Unlabelled axis 1 | 3", "Quality (axis 2) | 7", "Quality (axis 3) | 5"]);
});

test("two axes labelled with zero-width characters only read unlabelled axis 1 and unlabelled axis 2", () => {
  // Zero-width characters draw as nothing, so these labels are blank, as in the pie and the xychart.
  const lines = radarLines([ZWSP, ZWSP, "Cost"], [["S", [3, 7, 5]]]);
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are unlabelled axis 1, unlabelled axis 2 and "Cost".');
  assert.deepEqual(seriesLines(lines), ['1. "S", averaging 5. Highest on unlabelled axis 2, lowest on unlabelled axis 1.']);
  assert.deepEqual(axisBullets(lines), ["   • Unlabelled axis 1: 3", "   • Unlabelled axis 2: 7", '   • "Cost": 5']);
  assert.deepEqual(tableRows(lines), ["Axis | S", "Unlabelled axis 1 | 3", "Unlabelled axis 2 | 7", "Cost | 5"]);
});

// ---------------------------------------------------------------------------------------------------
// Comparison: one "and", before the last part.

test("a comparison with a higher, a lower and an equal part has one 'and', before the equal part", () => {
  const lines = radarLines(
    ["Planning", "Quality", "Reach", "Speed"],
    [
      ["Team A", [5, 1, 3, 3]],
      ["Team B", [1, 5, 3, 3]],
    ],
  );
  assert.deepEqual(comparisonLines(lines), [
    '• "Team A" is higher than "Team B" on "Planning", lower on "Quality", and equal on "Reach" and "Speed".',
  ]);
});

test("a comparison with a higher and a lower part only keeps its 'and' before the lower part", () => {
  const lines = radarLines(
    ["Defence", "Attack", "Speed"],
    [
      ["Team A", [5, 1, 1]],
      ["Team B", [1, 5, 5]],
    ],
  );
  assert.deepEqual(comparisonLines(lines), ['• "Team A" is higher than "Team B" on "Defence", and lower on "Attack" and "Speed".']);
});

test("a comparison whose last part is the equal part also reads with one 'and'", () => {
  const lines = radarLines(
    ["Speed", "Power", "Skill"],
    [
      ["Team A", [40, 70, 55]],
      ["Team B", [60, 50, 55]],
    ],
  );
  assert.deepEqual(comparisonLines(lines), ['• "Team A" is higher than "Team B" on "Power", lower on "Speed", and equal on "Skill".']);
});

