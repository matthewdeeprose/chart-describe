// These tests pin one wording rule of the radar chart describer.
// The average of a series is never outside the series' own values. It is the mean rounded to a whole
// number, unless that lies below the lowest value or above the highest; then one decimal place, then
// two, and so on, and the first result inside the values is used. Equal values follow the same rule.
// Each test builds a one-series chart and checks the exact series line.
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
