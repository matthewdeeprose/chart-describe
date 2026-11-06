// These tests pin two rules of the Chart.js adapter.
// 1. A pie config whose dataset names another chart type draws that other type, so describe() must not call it a pie.
// 2. A pie config that draws less (or more) than a whole circle, through `circumference`, is a gauge, so describe()
//    refuses it: the shares of a whole pie would mislead.
// Each test builds a config and checks the exact result.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lib = require("./load.cjs");

const pieConfig = (datasetType) => ({
  type: "pie",
  data: {
    labels: ["A", "B"],
    datasets: [{ data: [1, 2], ...(datasetType === undefined ? {} : { type: datasetType }) }],
  },
});

const UNSUPPORTED_SERIES = { supported: false, reason: "unsupported-series-type" };

test("a pie config with a bar dataset is not described as a pie", () => {
  assert.deepEqual(lib.chartjs.describe(pieConfig("bar")), UNSUPPORTED_SERIES);
});

test("a pie config with a line dataset is not described as a pie", () => {
  assert.deepEqual(lib.chartjs.describe(pieConfig("line")), UNSUPPORTED_SERIES);
});

test("a pie config with a doughnut dataset is not described as a pie", () => {
  assert.deepEqual(lib.chartjs.describe(pieConfig("doughnut")), UNSUPPORTED_SERIES);
});

test("classify names the same reason for a pie config with a bar dataset", () => {
  const config = pieConfig("bar");
  assert.deepEqual(lib.chartjs.classify(lib.chartjs.toModel(config), config), UNSUPPORTED_SERIES);
});

test("a pie config whose dataset has no type is still a pie", () => {
  const result = lib.chartjs.describe(pieConfig(undefined));
  assert.equal(result.supported, true);
  assert.equal(
    result.short,
    "A pie chart showing the distribution of two categories. B is the largest segment at 66.7%, representing over half of the total.",
  );
});

test("a pie config whose dataset type is pie reads exactly as one with no dataset type", () => {
  assert.deepEqual(lib.chartjs.describe(pieConfig("pie")), lib.chartjs.describe(pieConfig(undefined)));
});

test("a bar config with a line dataset is still a mixed chart, not refused", () => {
  const result = lib.chartjs.describe({
    type: "bar",
    data: {
      labels: ["A", "B"],
      datasets: [
        { label: "Sales", data: [1, 2] },
        { label: "Target", type: "line", data: [2, 2] },
      ],
    },
  });
  assert.equal(result.supported, true);
});

// A pie config for two categories; `dataset` adds to the dataset, `options` sets the chart's options.
const gaugeConfig = (dataset, options) => ({
  type: "pie",
  data: { labels: ["Done", "Left"], datasets: [{ data: [70, 30], ...dataset }] },
  options,
});

const PARTIAL_CIRCLE = { supported: false, reason: "partial-circle" };

test("a pie config drawn as a half-circle through options.circumference is refused", () => {
  assert.deepEqual(lib.chartjs.describe(gaugeConfig({}, { circumference: 180 })), PARTIAL_CIRCLE);
});

test("a pie config drawn as three quarters through the dataset's circumference is refused", () => {
  assert.deepEqual(lib.chartjs.describe(gaugeConfig({ circumference: 270 }, {})), PARTIAL_CIRCLE);
});

test("classify names the same reason for a partial circle", () => {
  const config = gaugeConfig({}, { circumference: 180 });
  assert.deepEqual(lib.chartjs.classify(lib.chartjs.toModel(config), config), PARTIAL_CIRCLE);
});

test("the dataset's circumference beats the chart's, in both directions", () => {
  assert.equal(lib.chartjs.describe(gaugeConfig({ circumference: 360 }, { circumference: 180 })).supported, true);
  assert.deepEqual(lib.chartjs.describe(gaugeConfig({ circumference: 180 }, { circumference: 360 })), PARTIAL_CIRCLE);
});

test("a pie config drawn as a whole circle is still described", () => {
  assert.equal(lib.chartjs.describe(gaugeConfig({}, { circumference: 360 })).supported, true);
  assert.equal(lib.chartjs.describe(gaugeConfig({}, {})).supported, true);
  assert.equal(lib.chartjs.describe(gaugeConfig({}, { circumference: null })).supported, true);
});
