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

// ---------------------------------------------------------------------------------------------------
// A hole in the data is a missing value; a series with no values, a total that overflows, a title Chart.js
// does not draw, a ring (a pie with `cutout`) and a title with a line break are not described as they stand.

const simplePie = (extra = {}, data = [1, 2, 3], dataset = {}) => ({
  type: "pie",
  data: { labels: ["A", "B", "C"], datasets: [{ data, ...dataset }] },
  ...extra,
});
const simpleBar = (data, labels = ["A", "B", "C"], extra = {}) => ({
  type: "bar",
  data: { labels, datasets: [{ label: "S", data }] },
  ...extra,
});
const titled = (text, display) => ({ options: { plugins: { title: display === undefined ? { text } : { text, display } } } });

test("a hole in the data array is refused as a missing value, as an explicit undefined is", () => {
  const NULL_VALUES = { supported: false, reason: "null-values" };
  const holeInMiddle = [1, , 3];
  const holeAtEnd = [1, 2, 3];
  delete holeAtEnd[2];
  assert.deepEqual(lib.chartjs.describe(simplePie({}, holeInMiddle)), NULL_VALUES);
  assert.deepEqual(lib.chartjs.describe(simplePie({}, holeAtEnd)), NULL_VALUES);
  assert.deepEqual(lib.chartjs.describe(simpleBar(holeInMiddle)), NULL_VALUES);
  assert.deepEqual(lib.chartjs.describe(simplePie({}, [1, undefined, 3])), NULL_VALUES);
  assert.equal(lib.chartjs.describe(simplePie({}, [1, 2, 3])).supported, true);
});

test("a bar or line series with no values is refused, not described as undefined", () => {
  const NO_DATA = { supported: false, reason: "no-data" };
  assert.deepEqual(lib.chartjs.describe(simpleBar([], ["A", "B"])), NO_DATA);
  assert.deepEqual(lib.chartjs.describe(simpleBar([], [])), NO_DATA);
  assert.deepEqual(lib.chartjs.describe({ type: "line", data: { labels: ["A"], datasets: [{ label: "S", data: [] }] } }), NO_DATA);
  const oneEmpty = { type: "bar", data: { labels: ["A", "B"], datasets: [{ label: "S", data: [1, 2] }, { label: "T", data: [] }] } };
  assert.deepEqual(lib.chartjs.describe(oneEmpty), NO_DATA);
  assert.equal(lib.chartjs.describe(simpleBar([1, 2], ["A", "B"])).supported, true);
});

test("a pie whose finite values sum past the largest number is refused", () => {
  const NON_FINITE_TOTAL = { supported: false, reason: "non-finite-total" };
  assert.deepEqual(lib.chartjs.describe({ ...simplePie({}, [1e308, 1e308]), data: { labels: ["A", "B"], datasets: [{ data: [1e308, 1e308] }] } }), NON_FINITE_TOTAL);
  const large = { type: "pie", data: { labels: ["A", "B"], datasets: [{ data: [1e300, 1e300] }] } };
  assert.equal(lib.chartjs.describe(large).supported, true);
});

test("a title that Chart.js does not draw is not described", () => {
  const has = (config) => lib.chartjs.describe(config).short.includes("titled");
  assert.equal(has(simplePie(titled("Votes by colour"))), false);
  assert.equal(has(simplePie(titled("Votes by colour", false))), false);
  assert.equal(has(simplePie(titled("Votes by colour", true))), true);
  assert.equal(has(simpleBar([1, 2, 3], ["A", "B", "C"], titled("Sales"))), false);
  assert.equal(has(simpleBar([1, 2, 3], ["A", "B", "C"], titled("Sales", true))), true);
});

test("a pie with a cutout is a ring and is refused as a doughnut is", () => {
  const DOUGHNUT = { supported: false, reason: "unsupported-type-doughnut" };
  assert.deepEqual(lib.chartjs.describe(simplePie({ options: { cutout: "50%" } })), DOUGHNUT);
  assert.deepEqual(lib.chartjs.describe(simplePie({}, [1, 2, 3], { cutout: 80 })), DOUGHNUT);
  assert.deepEqual(lib.chartjs.describe(simplePie({ options: { cutout: 5 } })), DOUGHNUT);
  // A cutout of zero, in any spelling, or none, is a whole pie; the dataset's own beats the chart's.
  for (const cutout of [0, "0", "0%", undefined, null]) {
    assert.equal(lib.chartjs.describe(simplePie({ options: { cutout } })).supported, true, String(cutout));
  }
  assert.equal(lib.chartjs.describe(simplePie({ options: { cutout: "50%" } }, [1, 2, 3], { cutout: 0 })).supported, true);
});

test("a title written with a line break is refused as an array title is", () => {
  const MULTI_LINE = { supported: false, reason: "multi-line-title" };
  assert.deepEqual(lib.chartjs.describe(simplePie(titled("Line one\nLine two", true))), MULTI_LINE);
  assert.deepEqual(lib.chartjs.describe(simplePie(titled("Line one\r\nLine two", true))), MULTI_LINE);
  assert.deepEqual(lib.chartjs.describe(simpleBar([1, 2, 3], ["A", "B", "C"], titled("Line one\nLine two", true))), MULTI_LINE);
  assert.deepEqual(lib.chartjs.describe(simplePie(titled(["Line one", "Line two"], true))), MULTI_LINE);
  assert.equal(lib.chartjs.describe(simplePie(titled("One line", true))).supported, true);
});

test("a bar or line whose values sum past the largest number is refused, not described with an infinite average", () => {
  const NON_FINITE_TOTAL = { supported: false, reason: "non-finite-total" };
  for (const type of ["bar", "line"]) {
    const config = { type, data: { labels: ["A", "B"], datasets: [{ label: "S", data: [1e308, 1e308] }] } };
    assert.deepEqual(lib.chartjs.describe(config), NON_FINITE_TOTAL, type);
  }
  const large = { type: "bar", data: { labels: ["A", "B"], datasets: [{ label: "S", data: [1e307, 1e307] }] } };
  assert.equal(lib.chartjs.describe(large).supported, true, "a large total that still fits is described");
  assert.ok(!JSON.stringify(lib.chartjs.describe(large)).includes("Infinity"));
});

// The builder's own overflow refusal is the adapter's refusal, whatever order the values sum in.
test("a pie whose values sum within range in the order given but past it high to low is refused as non-finite-total", () => {
  const NON_FINITE_TOTAL = { supported: false, reason: "non-finite-total" };
  const pie = (data) => ({ type: "pie", data: { labels: data.map((_, index) => `S${index + 1}`), datasets: [{ data }] } });
  assert.deepEqual(lib.chartjs.describe(pie([1e308, -1e308, 1e308])), NON_FINITE_TOTAL);
  assert.deepEqual(lib.chartjs.describe(pie([1e308, 1e308, -1e308])), NON_FINITE_TOTAL, "the order the adapter already refused");
  assert.equal(lib.chartjs.describe(pie([1e307, -1e307, 1e307])).supported, true, "a sum that stays in range is described");
});
