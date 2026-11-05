// One test for every golden entry. Each entry holds a chart input and the outputs the library gave for it
// when the goldens were made. A change to any word, tag or space in a description turns the matching test red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { runEntry } = require("./load.cjs");

for (const family of ["pie", "radar", "xychart"]) {
  const entries = JSON.parse(readFileSync(new URL(`./goldens/${family}.json`, import.meta.url), "utf8"));
  for (const entry of entries) {
    test(`${family} golden: ${entry.id}`, () => {
      assert.ok(entry.expected, "the golden has an expected block");
      assert.equal(entry.expected.threw, undefined, "the golden records no error");
      assert.deepEqual(runEntry(entry), entry.expected);
    });
  }
}
