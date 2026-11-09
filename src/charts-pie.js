/**
 * Chart description builders: the pie family.
 *
 * This file exports buildPieModel and keeps everything that function needs.
 * It serves pie, doughnut and polar-area charts. It exports itself as
 * window.ChartDescribePie. In Node it also sets module.exports.
 *
 * It reads the helpers in charts-shared.js when a function runs, never when
 * the file loads. It needs text.js, model.js and charts-shared.js to load
 * before it. charts.js is the front door that callers use.
 */
(function (root) {
  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level - can be modified at runtime
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Chart Describe Pie] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe Pie] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe Pie] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe Pie] DEBUG: ${message}`, ...args);
    }
  }

  // ---------------------------------------------------------------------
  // The shared helpers, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------
  //
  // A module-scope capture would read undefined permanently if this file ran
  // before charts-shared.js. Resolving at call time costs one property read and cannot
  // go stale, so load order between the chart-describe files cannot matter.

  /**
   * ChartDescribeChartsShared: from the global when present, otherwise (Node only) from
   * ./charts-shared.js. Throws if neither exists, so a missing file fails loudly rather
   * than returning wrong text.
   * @returns {Object} ChartDescribeChartsShared
   */
  function shared() {
    if (root.ChartDescribeChartsShared) return root.ChartDescribeChartsShared;
    if (typeof require === "function") return require("./charts-shared.js");
    throw new Error("ChartDescribeChartsShared is not loaded");
  }

  /** The shared `countWord` (charts-shared.js), resolved at call time. */
  function countWord(value) {
    return shared().countWord(value);
  }

  /** The shared `modelCore` (charts-shared.js), resolved at call time. */
  function modelCore() {
    return shared().modelCore();
  }

  /** The shared `joinRuns` (charts-shared.js), resolved at call time. */
  function joinRuns(entries) {
    return shared().joinRuns(entries);
  }

  // ---------------------------------------------------------------------
  // Pie chart builders
  // ---------------------------------------------------------------------
  //
  // These builders describe pie, doughnut and polar-area charts, so every
  // adapter speaks about them with one voice. escapeHtml and formatList come
  // from ChartDescribeText through textCore(). Change a sentence only on
  // purpose, because the goldens in test/ pin the wording.
  //
  // The chart they describe is a list of { name, value } segments.

  /**
   * Render a segment value or total at the precision the author wrote it
   *
   * An integer renders bare, so a count of 142 is not read out as "142.0";
   * a value the author wrote with decimals renders exactly as the number
   * holds it. This is the single choke point for VALUE rendering, so no call
   * site can impose a fixed precision on its own.
   *
   * PERCENTAGES do not come through here. They are computed rather than
   * authored, and one decimal place is the right precision for them, so they
   * keep their own toFixed(1).
   *
   * @param {number} value - The segment value or total
   * @returns {string} The value as text, with no imposed precision
   */
  function formatValue(value) {
    const written = String(value);
    // JavaScript switches to exponent form at 1e21 and above, and at 1e-7 and below.
    const parts = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(written);
    if (!parts) return written;
    const [, sign, whole, fraction = "", exponent] = parts;
    const digits = whole + fraction;
    const point = whole.length + Number(exponent);
    if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
    if (point >= digits.length) return sign + digits + "0".repeat(point - digits.length);
    return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
  }

  // A share this close to a simple fraction IS that fraction: the sum of
  // authored decimals carries floating-point noise (1/3 of 0.3 is not 0.1).
  const FRACTION_TOLERANCE = 1e-12;
  const SIGNIFICANT_DIGITS = 12;
  // A total with a whole part this long needs more digits to keep its fraction.
  // Float noise from adding values sits beyond the fifteenth digit.
  const LARGE_TOTAL_WHOLE_DIGITS = 12;
  const LARGE_TOTAL_DIGITS = 15;
  // A share that prints as 0.0% but is above zero reads as this instead.
  const BELOW_ONE_TENTH = "less than 0.1%";
  // A share below the whole that prints as 100.0% reads as this instead.
  const ABOVE_99_9 = "more than 99.9%";

  // One emptiness test for every name AND every title (shared across the three files): white space,
  // Unicode format characters, every character Unicode marks Default_Ignorable_Code_Point (combining grapheme
  // joiner, Hangul fillers, Khmer vowel inherents, Mongolian selectors, variation selectors, tag characters),
  // and the Braille blank (which draws as nothing but is not default-ignorable). The C0 and C1 controls and U+180F are NOT in the
  // set: Chromium draws or advances them, so a name made of them is something a sighted reader sees.
  const INVISIBLE_CHARS = "[\\s\\p{Cf}\\p{Default_Ignorable_Code_Point}\\u2800]";
  // Mongolian free variation selector four is Default_Ignorable but Chromium draws it, so it is excluded where the class is used.
  const INVISIBLE_ONE = `(?:(?!\\u180F)${INVISIBLE_CHARS})`;
  const BLANK_TEXT = new RegExp(`^${INVISIBLE_ONE}*$`, "u");
  const BLANK_EDGES = new RegExp(`^${INVISIBLE_ONE}+|${INVISIBLE_ONE}+$`, "gu");

  /** The noun for a count: "category" for one, "categories" otherwise. */
  /** True when the author gave a title: not undefined, null, empty or only spaces. A title of 0 counts. */
  function hasTitle(title) {
    return title !== undefined && title !== null && !BLANK_TEXT.test(String(title));
  }

  function categoryNoun(count) {
    return count === 1 ? "category" : "categories";
  }

  // A whole number below this prints in full (JavaScript writes 1e21 and above in exponent form), so a
  // whole-number total needs no rounding. Above 2^53 a double holds no fraction, so there is no noise to remove.
  const WHOLE_TOTAL_PRINTS_IN_FULL = 1e21;

  /**
   * A total with float noise removed: twelve significant digits, unless it is
   * a whole number, which is written as it is. A total with twelve or
   * more whole digits keeps fifteen, so its fraction survives. A rounding that
   * would overflow (a finite sum near the largest number) keeps the unrounded total.
   */
  function cleanTotal(total, places = 0) {
    if (Number.isInteger(total) && Math.abs(total) < WHOLE_TOTAL_PRINTS_IN_FULL) {
      return total;
    }
    const wholeDigits = String(Math.trunc(Math.abs(total))).length;
    // The finest decimal place any value carries is exact in the sum while the whole part and those places
    // fit in fifteen digits, so the total is written to that place and no noise digit survives.
    if (wholeDigits + places <= LARGE_TOTAL_DIGITS) {
      return Number(total.toFixed(places));
    }
    const digits =
      wholeDigits >= LARGE_TOTAL_WHOLE_DIGITS
        ? LARGE_TOTAL_DIGITS
        : SIGNIFICANT_DIGITS;
    const rounded = Number(total.toPrecision(digits));
    return Number.isFinite(rounded) ? rounded : total;
  }

  /** The most decimal places any segment value is written with. */
  function finestDecimalPlaces(segments) {
    return segments.reduce((finest, segment) => {
      const text = formatValue(segment.value);
      const point = text.indexOf(".");
      return point < 0 ? finest : Math.max(finest, text.length - point - 1);
    }, 0);
  }

  /** True when any segment is below zero, so its share of a pie has no meaning. */
  function hasNegativeValue(segments) {
    return segments.some((segment) => segment.value < 0);
  }

  /** True when shares can be stated: no negative value, and a total above zero. */
  function sharesAreStated(segments, total) {
    return total > 0 && !hasNegativeValue(segments);
  }

  /**
   * A percentage as narration: one decimal place, except that a non-zero share
   * which would print as 0.0% reads "less than 0.1%".
   */
  function formatPercentage(value, total) {
    const share = (value / total) * 100;
    const text = share.toFixed(1);
    if (value > 0 && text === "0.0") return BELOW_ONE_TENTH;
    return value < total && text === "100.0" ? ABOVE_99_9 : text + "%";
  }

  /**
   * The phrase for the largest share, tested on the UNROUNDED fraction.
   * "exactly" when within tolerance of the fraction, "over" only above it.
   */
  function proportionPhrase(value, total) {
    const fraction = value / total;
    const near = (target) => Math.abs(fraction - target) <= FRACTION_TOLERANCE;
    // The share as the reader hears it. One that prints as a simple fraction
    // without being it reads "about", so "50.0%" never sits beside "over half".
    const printsAs = (target) =>
      (fraction * 100).toFixed(1) === (target * 100).toFixed(1);
    if (near(1 / 2)) return "exactly half";
    if (printsAs(1 / 2)) return "about half";
    if (fraction > 1 / 2) return "over half";
    if (near(1 / 3)) return "exactly a third";
    if (printsAs(1 / 3)) return "about a third";
    if (fraction > 1 / 3) return "over a third";
    if (near(1 / 4)) return "exactly a quarter";
    if (printsAs(1 / 4)) return "about a quarter";
    if (fraction > 1 / 4) return "over a quarter";
    return "";
  }

  /**
   * The ties at the top and bottom of a descending-sorted list, and whether
   * every slice is equal. A single slice is neither tied nor "all equal".
   */
  function readTies(segments) {
    const first = segments[0].value;
    const last = segments[segments.length - 1].value;
    const tiedWith = (anchor) => (segment) =>
      segment.value === anchor ||
      Math.abs(segment.value - anchor) <=
        FRACTION_TOLERANCE * Math.max(Math.abs(segment.value), Math.abs(anchor));
    const largest = segments.filter(tiedWith(first));
    const allEqual = segments.length > 1 && largest.length === segments.length;
    // The tolerance is not transitive: a middle value can sit within it of both ends while the ends are not
    // tied with each other. The largest group keeps such a value, and the smallest group does not repeat it.
    const smallest = segments
      .filter(tiedWith(last))
      .filter((segment) => allEqual || !largest.includes(segment));
    return {
      largest,
      smallest,
      allEqual,
      largestSame: valuesAreSame(largest),
      smallestSame: valuesAreSame(smallest),
    };
  }

  // Digits a double carries reliably: two values equal at this many significant digits differ by float noise at most.
  const SAME_VALUE_DIGITS = 15;

  /** True when the segments' values are one value to the digits a double carries, so "each" and "equal" are true. */
  function valuesAreSame(group) {
    const key = (segment) => Number(segment.value.toPrecision(SAME_VALUE_DIGITS));
    return group.every((segment) => key(segment) === key(group[0]));
  }

  /** "All four segments are equal" (two slices read "Both"); "about equal" when the values differ. */
  function allEqualLead(count, same = true) {
    const equal = same ? "equal" : "about equal";
    return count === 2
      ? `Both segments are ${equal}`
      : `All ${countWord(count)} segments are ${equal}`;
  }

  // The kinds of section and list entry the pie model names. The adapter that
  // renders a pie chart supplies a profile that maps each kind to its own
  // class names.
  const PIE_ROLES = Object.freeze({
    CONSTRUCTION: "construction",
    INSIGHTS: "insights",
    DATA: "data",
    PATTERNS: "patterns",
    CATEGORIES: "categories",
    PRIMARY: "primary",
    TOTAL: "total",
    LARGEST: "largest",
    SMALLEST: "smallest",
  });

  const UNLABELLED_SEGMENT = "unlabelled segment";

  // A name is blank when it holds only white space and Unicode format characters
  // (zero-width space, zero-width joiner, word joiner, soft hyphen).
  const BLANK_NAME = BLANK_TEXT;
  // White space and format characters at either end of a name do not change how it sounds or looks.
  const NAME_EDGES = BLANK_EDGES;

  // What buildPieModel learned about each segment BEFORE it sorted them:
  // declaration position (over ALL segments), whether the name is blank,
  // whether the name repeats.
  const SEGMENT_NAMES = new WeakMap();

  function registerSegmentNames(segments) {
    const counts = new Map();
    segments.forEach((segment) => {
      const name = String(segment.name);
      if (BLANK_NAME.test(name)) return;
      const key = name.replace(NAME_EDGES, "");
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    segments.forEach((segment, index) => {
      const name = String(segment.name);
      const unlabelled = BLANK_NAME.test(name);
      SEGMENT_NAMES.set(segment, {
        position: index + 1,
        unlabelled,
        // A blank name is never "repeated": it already reads "unlabelled segment N".
        repeated: !unlabelled && counts.get(name.replace(NAME_EDGES, "")) > 1,
      });
    });
  }

  /**
   * A segment's name as the chart author wrote it, a label term over one author
   * run. A blank name is the describer's own phrase, "unlabelled segment N".
   * A name the chart uses more than once carries its declaration position,
   * "North (segment 2)", in every place it appears. Author text is never changed.
   * @param {Object} segment - A segment
   * @param {Object} [options] - { opening: true } where the name opens a
   *   sentence or a list item
   */
  function segmentLabel(segment, options = {}) {
    const { text, term, author } = modelCore();
    const name = String(segment.name);
    const facts = SEGMENT_NAMES.get(segment);
    if (facts && facts.unlabelled) {
      const phrase = `${UNLABELLED_SEGMENT} ${facts.position}`;
      return term("label", [
        text(options.opening ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase),
      ]);
    }
    if (facts && facts.repeated) {
      return term("label", [author(name), text(` (segment ${facts.position})`)]);
    }
    return term("label", [author(name)]);
  }

  /**
   * One Key Insights entry for the largest or the smallest group. A group of
   * one reads "Largest segment: X (v, p)"; a tie reads "Largest segments: X and
   * Y (v each, p each)".
   * @returns {Object} A list entry (model item)
   */
  function extremeItem(kind, label, group, total, same = true) {
    const { text, term, item } = modelCore();
    const tied = group.length > 1;
    const each = tied ? [text(" each")] : [];
    // A tie whose values differ lists each value, so "each" is never said of values that are not one value.
    const values = tied && !same
      ? joinRuns(group.map((segment) => [term("value", [text(formatValue(segment.value))])]))
      : [term("value", [text(formatValue(group[0].value))]), ...each];

    return item(
      [
        text(`${label} segment${tied ? "s" : ""}: `),
        ...joinRuns(group.map((segment) => [segmentLabel(segment)])),
        text(" ("),
        ...values,
        text(", "),
        term("percentage", [text(formatPercentage(group[0].value, total))]),
        ...each,
        text(")"),
      ],
      { role: kind }
    );
  }

  const PIE_TOTAL_OVERFLOW = "The pie values add up to more than a number can hold.";

  // A tie of more names than the cap is cut to the first few and a count, so the short description does
  // not grow with the size of a tie. The Largest segments line in Key Insights still names them all.
  const TIE_NAMES_CAP = 5;
  const TIE_NAMES_KEPT = 5;

  function tiedNames(group) {
    const { text } = modelCore();
    const label = (segment, index) => [segmentLabel(segment, { opening: index === 0 })];
    if (group.length <= TIE_NAMES_CAP) return joinRuns(group.map(label));
    const runs = [];
    group.slice(0, TIE_NAMES_KEPT).forEach((segment, index) => {
      if (index > 0) runs.push(text(", "));
      runs.push(...label(segment, index));
    });
    runs.push(text(` and ${countWord(group.length - TIE_NAMES_KEPT)} more`));
    return runs;
  }

  const ZERO_SENTENCE =
    "Every value is zero, so no segment is larger than another.";

  const NEGATIVE_SENTENCE =
    "Some values are negative, so shares are not given.";

  /**
   * The sentence that names the largest segment(s), as runs. This is the one
   * place the short description and the Key Insights read from, so they
   * cannot drift apart.
   * @returns {Array} The runs of the sentence
   */
  function largestSentence(segments, total) {
    const { text, term } = modelCore();
    if (hasNegativeValue(segments)) return [text(NEGATIVE_SENTENCE)];
    if (total === 0 && segments.length === 1) {
      return [segmentLabel(segments[0], { opening: true }), text(" is the only segment, and its value is zero.")];
    }
    if (total === 0) return [text(ZERO_SENTENCE)];

    const ties = readTies(segments);
    const largest = segments[0];
    const percentage = term("percentage", [
      text(formatPercentage(largest.value, total)),
    ]);

    // One segment is the whole pie, not the largest of several.
    if (segments.length === 1) {
      return [
        segmentLabel(largest, { opening: true }),
        text(" is the only segment, at "),
        percentage,
        text(" of the total."),
      ];
    }

    if (ties.allEqual) {
      return [
        text(`${allEqualLead(segments.length, ties.largestSame)}, at `),
        percentage,
        text(" each."),
      ];
    }

    if (ties.largest.length > 1) {
      return [
        ...tiedNames(ties.largest),
        text(" are the joint largest segments, at "),
        percentage,
        text(" each."),
      ];
    }

    const proportion = proportionPhrase(largest.value, total);
    return [
      segmentLabel(largest, { opening: true }),
      text(" is the largest segment at "),
      percentage,
      ...(proportion
        ? [
            text(", representing "),
            term("proportion", [text(proportion)]),
            text(" of the total"),
          ]
        : []),
      text("."),
    ];
  }

  /**
   * The pie chart's description as a model: the short sentence as runs and
   * four sections (construction, insights, data, patterns). Author text
   * (the title and the segment names) enters only as author runs, raw; the
   * renderer escapes it once. Sorts `segments` in place, highest value first.
   * @param {string} title - The chart title, or an empty string
   * @param {Array<{name: string, value: number}>} segments - The segments
   * @returns {Object} A DescriptionModel (see model.js)
   */
  function buildPieModel(title, segments) {
    const { text, author, term, strong, paragraph, list, item, section } =
      modelCore();

    registerSegmentNames(segments);

    // Sort segments by value (descending)
    segments.sort((a, b) => b.value - a.value);

    logDebug("Processed " + segments.length + " segments");

    const total = segments.reduce((sum, segment) => sum + segment.value, 0);

    // Finite values whose float sum overflows would give every segment a share of 0%. Refuse, as a thrown
    // error with a stable message, rather than describe a chart wrongly. (NaN and Infinity inputs are not this case.)
    if (!Number.isFinite(total) && segments.every((segment) => Number.isFinite(segment.value))) {
      throw new RangeError(PIE_TOTAL_OVERFLOW);
    }

    logDebug("Total value across all segments: " + total);

    const titleRuns = hasTitle(title)
      ? [text(' titled "'), term("title", [author(String(title))]), text('"')]
      : [];

    // 1. The short description. An untitled chart has no "titled" clause.
    const countClause = segments.length
      ? ` showing the distribution of ${countWord(segments.length)} ${categoryNoun(segments.length)}.`
      : " with no categories.";
    const short = [text("A pie chart"), ...titleRuns, text(countClause)];
    if (segments.length > 0) {
      short.push(text(" "), ...largestSentence(segments, total));
    }

    // 2. Chart Construction
    const constructionBlocks = [
      paragraph([
        text("This pie chart"),
        ...titleRuns,
        text(segments.length ? " shows the distribution of categories." : " has no categories."),
      ]),
    ];
    if (segments.length > 0) {
      constructionBlocks.push(
        paragraph([
          text("The chart shows "),
          term("count", [text(countWord(segments.length))]),
          text(` ${categoryNoun(segments.length)}:`),
        ]),
        // The author's name, as written. Every section spells a category the
        // same way.
        list(
          segments.map((segment) => item([segmentLabel(segment, { opening: true })])),
          { role: PIE_ROLES.CATEGORIES }
        )
      );
    }

    // 3. Key Insights
    const insightItems = [];
    if (segments.length > 0) {
      insightItems.push(
        item([strong(largestSentence(segments, total))], {
          role: PIE_ROLES.PRIMARY,
        })
      );
    }

    // The total, with float noise removed
    insightItems.push(
      item(
        [
          text("Total: "),
          term("value", [text(formatValue(cleanTotal(total, finestDecimalPlaces(segments))))]),
        ],
        { role: PIE_ROLES.TOTAL }
      )
    );

    // Largest and smallest segments. When every value is zero there are no
    // percentages to narrate; when every slice is equal the primary insight
    // has said so, and a largest and a smallest line would contradict it.
    if (segments.length > 0 && sharesAreStated(segments, total)) {
      const ties = readTies(segments);
      if (!ties.allEqual && segments.length > 1) {
        insightItems.push(
          extremeItem(PIE_ROLES.LARGEST, "Largest", ties.largest, total, ties.largestSame),
          extremeItem(PIE_ROLES.SMALLEST, "Smallest", ties.smallest, total, ties.smallestSame)
        );
      }
    }

    // 4. Complete Data Points: every segment with its value, and its
    // percentage unless every value is zero (there is no share to state).
    const statesShares = sharesAreStated(segments, total);
    const dataItems = segments.map((segment) =>
      item(
        [
          segmentLabel(segment, { opening: true }),
          text(": "),
          term("value", [text(formatValue(segment.value))]),
          ...(statesShares
            ? [
                text(" ("),
                term("percentage", [
                  text(formatPercentage(segment.value, total)),
                ]),
                text(")"),
              ]
            : []),
        ],
        { role: PIE_ROLES.DATA }
      )
    );

    const sections = [
      section(constructionBlocks, {
        role: PIE_ROLES.CONSTRUCTION,
        heading: [text("Chart Construction")],
      }),
      section([list(insightItems, { role: PIE_ROLES.INSIGHTS })], {
        role: PIE_ROLES.INSIGHTS,
        heading: [text("Key Insights")],
      }),
      // An empty pie has no data points to list.
      ...(segments.length
        ? [
            section([list(dataItems, { role: PIE_ROLES.DATA })], {
              role: PIE_ROLES.DATA,
              heading: [text("Complete Data Points")],
            }),
          ]
        : []),
    ];

    // The pattern section needs enough segments to identify patterns, and a
    // total to state them against
    if (segments.length >= 3 && statesShares) {
      logDebug(
        "Generating pattern analysis for " + segments.length + " segments"
      );
      const pattern = generatePatternSection(segments, total);
      if (pattern) sections.push(pattern);
    }

    return modelCore().description(short, sections);
  }

  /**
   * The section that describes patterns in the pie chart data
   * @param {Array} segments - Array of segment objects
   * @param {number} total - Total value of all segments
   * @returns {Object} The patterns section (model section)
   */
  function generatePatternSection(segments, total) {
    const { text, term, paragraph, section } = modelCore();

    logDebug("Analysing distribution patterns");

    // This section makes no skewed or balanced judgement: the percentages
    // above carry the facts, and an average segment size would only restate
    // 100 divided by the count. The section is left out when it has nothing to say.
    const runs = [];

    // Add group information if there are more than 4 segments
    if (segments.length > 4 && !readTies(segments).allEqual) {
      // Calculate the combined percentage of the smallest segments (bottom half)
      const bottomHalfCount = Math.floor(segments.length / 2);
      const bottomHalf = segments.slice(segments.length - bottomHalfCount);
      const bottomHalfTotal = bottomHalf.reduce(
        (sum, segment) => sum + segment.value,
        0
      );
      const bottomHalfPercentage = formatPercentage(bottomHalfTotal, total);

      logDebug(
        "Bottom " +
          bottomHalf.length +
          " segments represent " +
          bottomHalfPercentage +
          "% of total"
      );

      // One space sits between the words. Keep it a plain string: a template
      // literal here would carry its line break and indentation into the text.
      runs.push(
        text("The bottom "),
        term("count", [text(countWord(bottomHalf.length))]),
        text(" segments collectively represent "),
        term("percentage", [text(bottomHalfPercentage)]),
        text(" of the total.")
      );
    }

    if (runs.length === 0) return null;

    return section([paragraph(runs)], {
      role: PIE_ROLES.PATTERNS,
      heading: [text("Distribution Pattern")],
    });
  }

  logInfo("Pie builder initialised successfully");

  const api = {
    buildPieModel,
    PIE_TOTAL_OVERFLOW,
  };

  root.ChartDescribePie = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
