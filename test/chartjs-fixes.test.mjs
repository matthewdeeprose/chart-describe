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

test("a null row beside points or range rows is a gap, and the config is refused for the kind of its other rows", () => {
  const reason = (config) => lib.chartjs.describe(config).reason;
  assert.equal(reason(simpleBar([null, [1, 3], [2, 5]])), "range-data");
  assert.equal(reason(simpleBar([[1, 3], null, [2, 5]])), "range-data");
  assert.equal(reason(simpleBar([null, { x: "B", y: 2 }, { x: "C", y: 3 }])), "point-data");
  assert.equal(reason(simpleBar([{ x: "B", y: 2 }, undefined])), "point-data");
  const line = { type: "line", data: { datasets: [{ label: "S", data: [{ x: "P", y: 4 }, null] }] } };
  assert.equal(reason(line), "point-data");
  // A gap among plain numbers keeps its own reason, and a config that really is malformed is still invalid.
  assert.equal(reason(simpleBar([1, null, 3])), "null-values");
  assert.equal(reason({ type: "bar", data: { labels: ["A"], datasets: [null] } }), "invalid-config");
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

test("a dataset whose data is a string, number or boolean is refused as invalid-config; absent or null data is still no data", () => {
  const reason = (config) => lib.chartjs.describe(config).reason;
  for (const data of ["123", "abc", 5, 0, true]) {
    assert.equal(reason(simpleBar(data)), "invalid-config", JSON.stringify(data));
    assert.equal(reason(simplePie({}, data)), "invalid-config", JSON.stringify(data));
  }
  assert.equal(reason(simpleBar(null)), "no-data");
  assert.equal(reason(simpleBar(undefined)), "no-data");
  assert.equal(reason(simpleBar([])), "no-data");
  // Keyed object data keeps its own reason.
  assert.equal(reason(simpleBar({ A: 1, B: 2, C: 3 })), "object-data");
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

test("a scales option that is not an object is ignored, as Chart.js ignores it, and so is a scale entry that is not an object", () => {
  const withScales = (scales) => simpleBar([1, 2, 3], ["A", "B", "C"], { options: { scales } });
  for (const scales of ["x", "xy", 5, true, null, [], { y: "bad" }, { z: "bad" }, { x: 5, y: [1] }]) {
    assert.equal(lib.chartjs.describe(withScales(scales)).supported, true, JSON.stringify(scales));
  }
  // An entry that is an object still counts: a stacked scale, and a second value axis.
  assert.deepEqual(lib.chartjs.describe(withScales({ y: { stacked: true } })), { supported: false, reason: "stacked" });
  assert.deepEqual(lib.chartjs.describe(withScales({ z: { axis: "y" } })), { supported: false, reason: "multiple-value-axes" });
});

// An empty label is a string Chart.js draws as nothing, so it reads as unlabelled, the same as a label of spaces.
test("an empty label reads as unlabelled, as a label of spaces does; a label that is not a string is still refused", () => {
  const config = (type, labels) => ({ type, data: { labels, datasets: [{ label: "S", data: [1, 2, 3] }] } });
  for (const blank of ["", "   "]) {
    const pie = lib.chartjs.describe(config("pie", ["A", blank, "C"]));
    assert.equal(pie.supported, true, JSON.stringify(blank));
    assert.ok(pie.detailed.includes("Unlabelled segment 2"), JSON.stringify(blank));
    const bar = lib.chartjs.describe(config("bar", ["A", blank, "C"]));
    assert.equal(bar.supported, true, JSON.stringify(blank));
    assert.ok(bar.detailed.includes("Unlabelled category 2"), JSON.stringify(blank));
  }
  assert.deepEqual(lib.chartjs.describe(config("pie", ["A", 2, "C"])), { supported: false, reason: "non-string-label" });
});

test("floating bars, keyed object data and a malformed config are each refused for their own cause", () => {
  const reason = (config) => lib.chartjs.describe(config).reason;
  // Floating bars: each row is a pair [low, high], not a point.
  assert.equal(reason(simpleBar([[1, 3], [2, 5], [0, 4]])), "range-data");
  // Rows that are points keep their reason.
  assert.equal(reason(simpleBar([{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 4 }])), "point-data");
  // Keyed object data, with labels, without labels and as a pie, is one cause.
  assert.equal(reason(simpleBar({ A: 1, B: 2, C: 3 })), "object-data");
  assert.equal(reason({ type: "bar", data: { datasets: [{ label: "S", data: { A: 1, B: 2, C: 3 } }] } }), "object-data");
  assert.equal(reason(simplePie({}, { A: 1, B: 2, C: 3 })), "object-data");
  // A config Chart.js would not draw is refused as invalid, with no JavaScript message in the reason.
  assert.deepEqual(lib.chartjs.describe({ type: "bar", data: { labels: "ABC", datasets: [{ data: [1, 2, 3] }] } }), { supported: false, reason: "invalid-config" });
  assert.deepEqual(lib.chartjs.describe({ type: "bar", data: { labels: ["A"], datasets: [null] } }), { supported: false, reason: "invalid-config" });
  // A fault inside a shared builder keeps its own name and carries no message either.
  const realCharts = globalThis.ChartDescribeCharts;
  globalThis.ChartDescribeCharts = { ...realCharts, buildPieModel() { throw new Error("boom"); } };
  try {
    assert.deepEqual(lib.chartjs.describe(simplePie({}, [1, 2, 3])), { supported: false, reason: "builder-error" });
  } finally {
    globalThis.ChartDescribeCharts = realCharts;
  }
  // A supported config is still described.
  assert.equal(lib.chartjs.describe(simpleBar([1, 2, 3])).supported, true);
});

test("a scale whose stacked option is truthy but not true is refused as stacked, as Chart.js stacks on any truthy value", () => {
  const STACKED = { supported: false, reason: "stacked" };
  const stackedBar = (value, axis = "y") => ({
    type: "bar",
    data: { labels: ["Q1", "Q2", "Q3"], datasets: [{ label: "North", data: [10, 20, 30] }, { label: "South", data: [30, 20, 10] }] },
    options: { scales: { [axis]: { stacked: value } } },
  });
  for (const value of [true, "single", 1, "true", "yes", "false"]) {
    assert.deepEqual(lib.chartjs.describe(stackedBar(value)), STACKED, JSON.stringify(value));
    assert.deepEqual(lib.chartjs.describe(stackedBar(value, "x")), STACKED, JSON.stringify(value));
  }
  // A falsy value is not stacked in Chart.js, so the bar is described.
  for (const value of [false, 0, "", null, undefined]) {
    assert.equal(lib.chartjs.describe(stackedBar(value)).supported, true, JSON.stringify(value));
  }
  // The model flag follows the same test.
  assert.equal(lib.chartjs.toModel(stackedBar("single")).stacked, true);
  assert.equal(lib.chartjs.toModel(stackedBar(0)).stacked, false);
});

test("a typed array of numbers is a list, as Chart.js draws it, and is described like the array it holds", () => {
  const reason = (config) => lib.chartjs.describe(config).reason;
  const same = (make, label) => {
    assert.deepEqual(lib.chartjs.describe(simpleBar(make([1, 2, 3]))), lib.chartjs.describe(simpleBar([1, 2, 3])), label);
    assert.deepEqual(lib.chartjs.describe(simplePie({}, make([1, 2, 3]))), lib.chartjs.describe(simplePie({}, [1, 2, 3])), label);
  };
  for (const kind of [Float64Array, Float32Array, Int16Array, Int32Array, Uint8Array]) same((values) => kind.from(values), kind.name);
  assert.equal(lib.chartjs.describe(simpleBar(Float64Array.from([1, 2, 3]))).supported, true);
  // Keyed object data, and a view that is not a list of numbers, keep their own reason.
  assert.equal(reason(simpleBar({ A: 1, B: 2, C: 3 })), "object-data");
  assert.equal(reason(simpleBar(new DataView(new ArrayBuffer(8)))), "object-data");
});
