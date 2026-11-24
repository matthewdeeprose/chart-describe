// These tests pin two rules of the Chart.js adapter.
// 1. A pie config whose dataset names another chart type draws that other type, so describe() must not call it a pie.
// 2. A pie config that draws less (or more) than a whole circle, through `circumference`, is a gauge, so describe()
//    refuses it: the shares of a whole pie would mislead.
// Each test builds a config and checks the exact result.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
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
  assert.equal(reason(simpleBar(new DataView(new ArrayBuffer(8)))), "no-data");
});

test("a Float32Array reads the decimals the author put in, not the digits single precision adds", () => {
  const typed = [0.095, 0.095, 0.095, 0.105];
  const labels = ["A", "B", "C", "D"];
  const want = lib.chartjs.describe(simpleBar(Float64Array.from(typed), labels));
  const got = lib.chartjs.describe(simpleBar(Float32Array.from(typed), labels));
  assert.deepEqual(got, want);
  assert.match(got.detailed, /Values range from 0\.095 to 0\.105 with an average of 0\.098\./);
  assert.doesNotMatch(got.detailed, /0\.0949999988079071/);
  // Float16Array, where the runtime has one, stores fewer digits again and reads the same way.
  if (typeof Float16Array === "function") {
    assert.deepEqual(lib.chartjs.describe(simpleBar(Float16Array.from(typed), labels)), want);
  }
});

test("a Float32Array element reads back to what the array stores, at every single-precision edge", () => {
  const values = (data) => lib.chartjs.toModel(simpleBar(Float32Array.from(data), data.map((_, i) => "L" + i))).series[0].values;
  assert.deepEqual(values([1.401298464324817e-45]), [1e-45]); // the smallest subnormal
  assert.deepEqual(values([3.4028234663852886e38, -3.4028234663852886e38]), [3.4028234663852886e38, -3.4028234663852886e38]); // the largest float32, a whole number, read as held
  assert.equal(Object.is(values([-0, 0])[0], -0), true); // -0 keeps its sign
  assert.equal(Object.is(values([-0, 0])[1], 0), true);
  // Two doubles that single precision stores as one number read as that one number.
  assert.deepEqual(values([0.1, 0.10000000149011612]), [0.1, 0.1]);
  assert.deepEqual(values([16777217]), [16777216]);
  // Values that are not finite numbers come through unchanged, so the refusal is the same as before.
  const odd = values([NaN, Infinity]);
  assert.equal(Number.isNaN(odd[0]), true);
  assert.equal(odd[1], Infinity);
  assert.equal(lib.chartjs.describe(simpleBar(Float32Array.from([0.095, NaN, 0.105]))).reason, "non-numeric-values");
});

test("a Float64Array and the integer typed arrays keep every digit they hold", () => {
  const values = (data) => lib.chartjs.toModel(simpleBar(data, ["A", "B"])).series[0].values;
  assert.deepEqual(values(Float64Array.from([0.10000000149011612, 0.0949999988079071])), [0.10000000149011612, 0.0949999988079071]);
  assert.deepEqual(values(Int32Array.from([16777217, -2147483648])), [16777217, -2147483648]);
  assert.deepEqual(values(Uint8Array.from([255, 0])), [255, 0]);
});

test("a whole number a narrow float array holds is read as that number, never as a shorter whole number", () => {
  const values = (data) => lib.chartjs.toModel(simpleBar(data, Array.from(data, (_, i) => "L" + i))).series[0].values;
  const held = Float32Array.from([33554528, 33554488, 123456792, 2 ** 60 + 2 ** 37]);
  assert.deepEqual(values(held), Array.from(held));
  assert.match(lib.chartjs.describe(simpleBar(Float32Array.of(33554528), ["A"])).detailed, /Average value: 33554528\./);
  // A pie shares out the numbers the array holds, so its total is their sum.
  assert.deepEqual(lib.chartjs.describe(simplePie({}, Float32Array.of(123456792, 1, 1))), lib.chartjs.describe(simplePie({}, Float64Array.of(123456792, 1, 1))));
  // A number with a fraction still reads as the shortest decimal the array stores.
  assert.deepEqual(values(Float32Array.of(0.095, 0.105)), [0.095, 0.105]);
  if (typeof Float16Array === "function") {
    const half = Float16Array.from([4112, 4128, 30016, 2050]);
    assert.deepEqual(values(half), [4112, 4128, 30016, 2050]);
    assert.match(lib.chartjs.describe(simpleBar(Float16Array.of(4112), ["A"])).detailed, /Average value: 4112\./);
    assert.deepEqual(values(Float16Array.of(0.095)), [0.095]);
  }
});

test("a typed array made in another realm, or by a subclass that rejects a length, reads like one made here", () => {
  const typed = [0.095, 0.095, 0.095, 0.105];
  const labels = ["A", "B", "C", "D"];
  const kinds = ["Float32Array"].concat(typeof Float16Array === "function" ? ["Float16Array"] : []);
  for (const kind of kinds) {
    const foreign = vm.runInNewContext("new " + kind + "(" + JSON.stringify(typed) + ")");
    assert.equal(foreign instanceof globalThis[kind], false, kind + " made by vm is another realm's");
    const want = lib.chartjs.describe(simpleBar(globalThis[kind].from(typed), labels));
    assert.deepEqual(lib.chartjs.describe(simpleBar(foreign, labels)), want, kind);
    assert.match(want.detailed, /Values range from 0\.095 to 0\.105 with an average of 0\.098\./);
  }
  assert.deepEqual(
    lib.chartjs.describe(simplePie({}, vm.runInNewContext("new Float32Array([0.095, 0.2, 0.7])"))),
    lib.chartjs.describe(simplePie({}, Float64Array.of(0.095, 0.2, 0.7))),
  );
  // A view that is not a list of numbers is no data in another realm too.
  assert.equal(lib.chartjs.describe(simpleBar(vm.runInNewContext("new DataView(new ArrayBuffer(8))"))).reason, "no-data");
  // A subclass whose constructor will not take a bare length is still described.
  class Strict extends Float32Array {
    constructor(...args) {
      if (typeof args[0] === "number") throw new TypeError("a Strict array takes values, not a length");
      super(...args);
    }
  }
  const strict = lib.chartjs.describe(simpleBar(new Strict(typed), labels));
  assert.equal(strict.supported, true);
  assert.deepEqual(strict, lib.chartjs.describe(simpleBar(Float32Array.from(typed), labels)));
});

test("a Float64Array subclass that names itself a Float32Array keeps every digit it holds", () => {
  class Liar extends Float64Array {
    get [Symbol.toStringTag]() {
      return "Float32Array";
    }
  }
  const held = [0.10000000149011612, 0.0949999988079071];
  assert.deepEqual(lib.chartjs.toModel(simpleBar(new Liar(held), ["A", "B"])).series[0].values, held);
});

test("a typed array whose iterator is replaced is read by its elements, as Chart.js reads it", () => {
  const values = (data, labels) => lib.chartjs.toModel(simpleBar(data, labels)).series[0].values;
  const labels = ["A", "B", "C"];
  const held = [10, 20, 30];
  const kinds = [Float64Array, Int32Array, Float32Array].concat(typeof Float16Array === "function" ? [Float16Array] : []);
  for (const kind of kinds) {
    const want = lib.chartjs.describe(simpleBar(held, labels));
    assert.equal(want.short, 'A bar chart showing "S" for three categories. Values range from 10 to 30 with an average of 20.');
    // An iterator set on the array itself.
    const own = kind.from(held);
    own[Symbol.iterator] = function* () {
      yield* [5, 5, 5];
    };
    assert.deepEqual(values(own, labels), held, kind.name + " with its own iterator");
    assert.deepEqual(lib.chartjs.describe(simpleBar(own, labels)), want, kind.name + " with its own iterator");
    // A subclass that overrides the iterator.
    class OtherIterator extends kind {
      *[Symbol.iterator]() {
        yield* [99, 98, 97];
      }
    }
    assert.deepEqual(lib.chartjs.describe(simpleBar(new OtherIterator(held), labels)), want, kind.name + " subclass");
    const pie = lib.chartjs.describe(simplePie({}, new OtherIterator(held)));
    assert.deepEqual(pie, lib.chartjs.describe(simplePie({}, held)), kind.name + " subclass as a pie");
    assert.equal(pie.short, "A pie chart showing the distribution of three categories. C is the largest segment at 50.0%, representing exactly half of the total.");
  }
  // A narrow float array still reads the decimals the author put in, element by element.
  const narrow = Float32Array.of(0.095, 0.105);
  narrow[Symbol.iterator] = function* () {
    yield* [7, 7];
  };
  assert.deepEqual(values(narrow, ["A", "B"]), [0.095, 0.105]);
  // An iterator that throws is never called.
  const thrower = Float64Array.from(held);
  thrower[Symbol.iterator] = () => {
    throw new Error("never walked");
  };
  assert.deepEqual(lib.chartjs.describe(simpleBar(thrower, labels)), lib.chartjs.describe(simpleBar(held, labels)));
});

test("a typed array is read up to its own length, as Chart.js reads it", () => {
  const values = (data, labels) => lib.chartjs.toModel(simpleBar(data, labels)).series[0].values;
  const withLength = (data, length) => Object.defineProperty(data, "length", { value: length });
  const two = lib.chartjs.describe(simpleBar([10, 20], ["A", "B"]));
  assert.equal(two.short, 'A bar chart showing "S" for two categories. Values range from 10 to 20 with an average of 15.');
  // Chart.js parses data.length elements, so a length the page has replaced is the number of values drawn.
  assert.deepEqual(values(withLength(Float64Array.of(10, 20, 30), 2), ["A", "B"]), [10, 20]);
  assert.deepEqual(lib.chartjs.describe(simpleBar(withLength(Float64Array.of(10, 20, 30), 2), ["A", "B"])), two);
  assert.deepEqual(values(withLength(Float32Array.of(0.095, 0.105, 0.7), 2), ["A", "B"]), [0.095, 0.105]);
  class FirstTwo extends Float64Array {
    get length() {
      return 2;
    }
  }
  assert.deepEqual(lib.chartjs.describe(simpleBar(new FirstTwo([10, 20, 30]), ["A", "B"])), two);
  // A length of 0 is no data; a length past the end reads the missing elements as gaps, as an array with holes does.
  assert.equal(lib.chartjs.describe(simpleBar(withLength(Float64Array.of(10, 20, 30), 0), ["A"])).reason, "no-data");
  assert.equal(lib.chartjs.describe(simpleBar(withLength(Float64Array.of(10, 20, 30), 5), ["A", "B", "C", "D", "E"])).reason, "null-values");
  assert.equal(lib.chartjs.describe(simpleBar(withLength(Float32Array.of(10, 20, 30), 5), ["A", "B", "C", "D", "E"])).reason, "null-values");
});

test("a typed array on a detached buffer is an empty list, so it is no data and not a malformed config", () => {
  const NO_DATA = { supported: false, reason: "no-data" };
  for (const kind of [Int16Array, Float64Array, Float32Array]) {
    const buffer = new ArrayBuffer(16);
    const data = new kind(buffer);
    structuredClone(buffer, { transfer: [buffer] });
    assert.equal(data.length, 0, kind.name + " is detached");
    assert.deepEqual(lib.chartjs.toModel(simpleBar(data, ["A"])).series[0].values, [], kind.name);
    assert.deepEqual(lib.chartjs.describe(simpleBar(data, ["A"])), NO_DATA, kind.name);
    // A pie gets the reason an empty array of the same kind gets.
    assert.deepEqual(lib.chartjs.describe(simplePie({}, data)), lib.chartjs.describe(simplePie({}, new kind(0))), kind.name + " as a pie");
    // The same for an array left outside a resizable buffer that has shrunk.
    if (typeof ArrayBuffer.prototype.resize === "function") {
      const resizable = new ArrayBuffer(4 * kind.BYTES_PER_ELEMENT, { maxByteLength: 8 * kind.BYTES_PER_ELEMENT });
      const outside = new kind(resizable, 0, 4);
      resizable.resize(2 * kind.BYTES_PER_ELEMENT);
      assert.equal(outside.length, 0, kind.name + " is out of bounds");
      assert.deepEqual(lib.chartjs.describe(simpleBar(outside, ["A"])), NO_DATA, kind.name + " out of bounds");
    }
  }
});

// CD-81a: the picks: pb + ma (shared) + kb + da

test("a plain array whose iterator is replaced is read by its elements, as Chart.js reads it", () => {
  const held = [4, 5, 6, 7];
  const labels = ["A", "B", "C", "D"];
  const own = held.slice();
  own[Symbol.iterator] = function* () {
    yield 1;
    yield 1;
  };
  for (const type of ["bar", "line"]) {
    const want = lib.chartjs.describe(simpleBar(held.slice(), labels, { type }));
    assert.equal(want.supported, true, type);
    assert.deepEqual(lib.chartjs.toModel(simpleBar(own, labels, { type })).series[0].values, held, type);
    assert.deepEqual(lib.chartjs.describe(simpleBar(own, labels, { type })), want, type);
  }
  // An iterator that throws is never called.
  const thrower = held.slice();
  thrower[Symbol.iterator] = () => {
    throw new Error("never walked");
  };
  assert.deepEqual(lib.chartjs.describe(simpleBar(thrower, labels)), lib.chartjs.describe(simpleBar(held.slice(), labels)));
});

test("a plain array whose iterator is replaced is the same pie as the array it holds, and is not refused for a length it does not have", () => {
  const held = [10, 20, 30];
  const own = held.slice();
  own[Symbol.iterator] = function* () {
    yield 99;
  };
  const want = lib.chartjs.describe(simplePie({}, held.slice()));
  assert.equal(want.supported, true);
  assert.deepEqual(lib.chartjs.describe(simplePie({}, own)), want);
});

test("a plain array whose methods are replaced is read by its elements, as Chart.js reads it", () => {
  const held = [4, 5, 6, 7];
  const labels = ["A", "B", "C", "D"];
  const want = lib.chartjs.describe(simpleBar(held.slice(), labels));
  assert.equal(want.supported, true);
  // Chart.js never calls find, filter, some, map, slice or forEach on the data, so replacing them draws nothing different.
  const replaced = held.slice();
  replaced.find = () => ({ x: 1, y: 2 });
  replaced.filter = () => [];
  replaced.some = () => true;
  replaced.map = () => [];
  replaced.slice = () => [];
  replaced.forEach = () => {};
  assert.deepEqual(lib.chartjs.describe(simpleBar(replaced, labels)), want);
  assert.deepEqual(lib.chartjs.describe(simpleBar(replaced, labels, { type: "line" })), lib.chartjs.describe(simpleBar(held.slice(), labels, { type: "line" })));
});

test("a typed array whose length Chart.js cannot allocate is refused, and one it reads as empty is no data", () => {
  const labels = ["A", "B", "C", "D"];
  const withLength = (value) => {
    const data = Uint8Array.of(9, 8, 7, 6);
    Object.defineProperty(data, "length", { get: () => value });
    return data;
  };
  const REFUSED = { supported: false, reason: "invalid-config" };
  // Chart.js throws "Invalid array length" for a length with a fraction and for one past the largest array, and draws nothing.
  for (const length of [0.5, 2.5, 3.5, 3.0000000001, Infinity, 2 ** 32, 1e10]) {
    assert.deepEqual(lib.chartjs.describe(simpleBar(withLength(length), labels)), REFUSED, "bar " + length);
    assert.deepEqual(lib.chartjs.describe(simpleBar(withLength(length), labels, { type: "line" })), REFUSED, "line " + length);
    assert.deepEqual(lib.chartjs.describe(simplePie({}, withLength(length))), REFUSED, "pie " + length);
  }
  assert.deepEqual(lib.chartjs.describe(simpleBar(withLength(2n), labels)), { supported: false, reason: "invalid-config" }, "a BigInt length");
  // It parses a length that is not a number, or is below zero, as an empty list, and a numeric string as its number.
  const NO_DATA = { supported: false, reason: "no-data" };
  for (const length of [0, -1, -0.5, -Infinity, NaN, "abc", undefined, null]) {
    assert.deepEqual(lib.chartjs.describe(simpleBar(withLength(length), labels)), NO_DATA, "bar " + String(length));
  }
  assert.deepEqual(lib.chartjs.toModel(simpleBar(withLength("2"), ["A", "B"])).series[0].values, [9, 8]);
  assert.deepEqual(lib.chartjs.toModel(simpleBar(withLength(true), ["A"])).series[0].values, [9]);
  // A whole length, even a long one, is read as before.
  assert.equal(lib.chartjs.describe(simpleBar(withLength(4), labels)).supported, true);
  assert.equal(lib.chartjs.describe(simpleBar(withLength(5), ["A", "B", "C", "D", "E"])).reason, "null-values");
  // A plain array behind a Proxy is held to the same length.
  const proxied = new Proxy([4, 5, 6, 7], { get: (target, key) => (key === "length" ? 2.5 : target[key]) });
  assert.deepEqual(lib.chartjs.describe(simpleBar(proxied, labels)), REFUSED, "a Proxy around an array");
});

test("a typed array that Object.prototype.toString calls an object is keyed data, as Chart.js reads it, and is refused as object-data", () => {
  const OBJECT_DATA = { supported: false, reason: "object-data" };
  const labels = ["Jan", "Feb", "Mar", "Apr"];
  const own = Uint16Array.of(2, 9, 4, 1);
  Object.defineProperty(own, Symbol.toStringTag, { value: "Object" });
  class Tagged extends Float64Array {
    get [Symbol.toStringTag]() {
      return "Object";
    }
  }
  const nullPrototype = Uint16Array.of(2, 9, 4, 1);
  Object.setPrototypeOf(nullPrototype, null);
  const arrayPrototype = Uint16Array.of(2, 9, 4, 1);
  Object.setPrototypeOf(arrayPrototype, Array.prototype);
  const cases = { "an own tag": own, "a subclass whose tag is Object": new Tagged([2, 9, 4, 1]), "no prototype": nullPrototype, "Array.prototype as prototype": arrayPrototype };
  for (const [name, data] of Object.entries(cases)) {
    assert.deepEqual(lib.chartjs.describe(simpleBar(data, labels)), OBJECT_DATA, "bar, " + name);
    assert.deepEqual(lib.chartjs.describe(simpleBar(data, labels, { type: "line" })), OBJECT_DATA, "line, " + name);
    assert.deepEqual(lib.chartjs.describe(simplePie({}, data)), OBJECT_DATA, "pie, " + name);
  }
});

test("a typed array with another tag, from another realm or on a shared buffer is still a list", () => {
  const labels = ["Jan", "Feb", "Mar", "Apr"];
  const held = [2, 9, 4, 1];
  const want = lib.chartjs.describe(simpleBar(held.slice(), labels));
  assert.equal(want.supported, true);
  class Other extends Float64Array {
    get [Symbol.toStringTag]() {
      return "Other";
    }
  }
  const shared = new Float64Array(new SharedArrayBuffer(32));
  shared.set(held);
  const forms = {
    "a subclass with another tag": new Other(held),
    "another realm": vm.runInNewContext("new Float64Array([2, 9, 4, 1])"),
    "a shared buffer": shared,
    "a Uint16Array": Uint16Array.from(held),
  };
  for (const [name, data] of Object.entries(forms)) {
    assert.deepEqual(lib.chartjs.describe(simpleBar(data, labels)), want, name);
  }
});

test("a plain array that Object.prototype.toString calls an object is keyed data too, as Chart.js reads it", () => {
  const OBJECT_DATA = { supported: false, reason: "object-data" };
  const labels = ["Jan", "Feb", "Mar", "Apr"];
  const own = [2, 9, 4, 1];
  Object.defineProperty(own, Symbol.toStringTag, { value: "Object" });
  class Tagged extends Array {
    get [Symbol.toStringTag]() {
      return "Object";
    }
  }
  assert.deepEqual(lib.chartjs.describe(simpleBar(own, labels)), OBJECT_DATA, "an own tag");
  assert.deepEqual(lib.chartjs.describe(simpleBar(Tagged.from([2, 9, 4, 1]), labels)), OBJECT_DATA, "a subclass whose tag is Object");
  // Another tag, or none, leaves an array a list.
  const other = [2, 9, 4, 1];
  Object.defineProperty(other, Symbol.toStringTag, { value: "Other" });
  assert.deepEqual(lib.chartjs.describe(simpleBar(other, labels)), lib.chartjs.describe(simpleBar([2, 9, 4, 1], labels)));
});

test("a DataView holds no element Chart.js can read, so it is no data, not object data", () => {
  const view = new DataView(new ArrayBuffer(32));
  assert.deepEqual(lib.chartjs.describe(simpleBar(view, ["A", "B", "C"])), { supported: false, reason: "no-data" });
  assert.deepEqual(lib.chartjs.describe(simpleBar(vm.runInNewContext("new DataView(new ArrayBuffer(32))"), ["A", "B", "C"])), { supported: false, reason: "no-data" }, "another realm");
  // A pie gets the reason an empty array gets.
  assert.deepEqual(lib.chartjs.describe(simplePie({}, view)), lib.chartjs.describe(simplePie({}, [])));
  // A view given a length Chart.js can read is read up to it: three gaps.
  const counted = new DataView(new ArrayBuffer(32));
  Object.defineProperty(counted, "length", { value: 3 });
  assert.deepEqual(lib.chartjs.describe(simpleBar(counted, ["A", "B", "C"])), { supported: false, reason: "null-values" });
});
