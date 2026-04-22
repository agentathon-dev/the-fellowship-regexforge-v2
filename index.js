/**
 * RegexForge — Fluent Regex Builder & Pattern Intelligence Engine
 * Build, test, explain, and optimize regex with semantic chainable methods.
 * @module RegexForge
 * @version 2.0.0
 * @example
 * const { forge, patterns, explain } = require('./regexforge');
 * const phone = forge().startOfLine().digits(3).literal("-").digits(4).endOfLine().build();
 * console.log(phone.test("555-1234")); // true
 * console.log(explain(phone)); // plain-English breakdown
 */

/**
 * Escapes special regex characters in a string for literal matching.
 * @param {string} text - String to escape
 * @returns {string} Escaped string safe for RegExp
 * @example escapeRegex("file.txt") // "file\\.txt"
 */
function escapeRegex(text) {
  if (typeof text !== "string") throw new TypeError("escapeRegex expects a string");
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeCharClass(chars) {
  return String(chars).replace(/[\]\\^-]/g, "\\$&");
}

function extractInner(content) {
  return content && typeof content._getParts === "function" ? content._getParts().join("") : String(content);
}

/**
 * Creates a new fluent regex builder. All methods return `this` for chaining.
 * Call `.build()` to get the final RegExp.
 * @returns {Object} Chainable builder with semantic regex methods
 * @example
 * forge().word().oneOrMore().literal("@").word().oneOrMore().literal(".").word().repeat(2,6).build()
 * @example
 * forge().namedCapture("year", forge().digits(4)).literal("-").namedCapture("month", forge().digits(2)).build()
 */
function forge() {
  var parts = [];
  var flags = "";
  var b = {
    /** Append raw regex syntax (not escaped). @param {string} pattern @returns {Object} this */
    raw: function(pattern) { if (typeof pattern !== "string") throw new TypeError("raw() expects string"); parts.push(pattern); return b; },
    /** Match literal text (auto-escaped). @param {string} text @returns {Object} this */
    literal: function(text) { parts.push(escapeRegex(String(text))); return b; },
    /** Match single digit [0-9]. @returns {Object} this */
    digit: function() { parts.push("\\d"); return b; },
    /** Match exactly n digits. @param {number} count @returns {Object} this
     * @example forge().digits(3).literal("-").digits(4).build() // /\d{3}-\d{4}/ */
    digits: function(count) { if (typeof count !== "number" || count < 1) throw new RangeError("digits() needs positive number"); parts.push("\\d{" + Math.floor(count) + "}"); return b; },
    /** Match single word character [a-zA-Z0-9_]. @returns {Object} this */
    word: function() { parts.push("\\w"); return b; },
    /** Match n word characters. @param {number} count @returns {Object} this */
    words: function(count) { parts.push("\\w{" + Math.floor(count) + "}"); return b; },
    /** Match single whitespace. @returns {Object} this */
    space: function() { parts.push("\\s"); return b; },
    /** Match one or more whitespace. @returns {Object} this */
    spaces: function() { parts.push("\\s+"); return b; },
    /** Match any character except newline. @returns {Object} this */
    any: function() { parts.push("."); return b; },
    /** Match any character from set. @param {string} characters @returns {Object} this
     * @example forge().anyOf("aeiou").build() // matches any vowel */
    anyOf: function(characters) { parts.push("[" + escapeCharClass(characters) + "]"); return b; },
    /** Match any character NOT in set. @param {string} characters @returns {Object} this */
    noneOf: function(characters) { parts.push("[^" + escapeCharClass(characters) + "]"); return b; },
    /** Match start of line (^). @returns {Object} this */
    startOfLine: function() { parts.push("^"); return b; },
    /** Match end of line ($). @returns {Object} this */
    endOfLine: function() { parts.push("$"); return b; },
    /** Make previous element or sub-builder optional (?).
     * @param {Object} [subBuilder] - forge() instance to wrap
     * @returns {Object} this
     * @example forge().literal("color").optional(forge().literal("u")).literal("r").build() */
    optional: function(subBuilder) {
      if (subBuilder && typeof subBuilder._getParts === "function") {
        parts.push("(?:" + subBuilder._getParts().join("") + ")?");
      } else if (parts.length > 0) {
        parts.push("(?:" + parts.pop() + ")?");
      }
      return b;
    },
    /** Repeat previous element {min,max} times. @param {number} min @param {number} [max] @returns {Object} this */
    repeat: function(min, max) { parts.push(max === undefined ? "{" + min + "}" : "{" + min + "," + max + "}"); return b; },
    /** One or more of previous (+). @returns {Object} this */
    oneOrMore: function() { parts.push("+"); return b; },
    /** Zero or more of previous (*). @returns {Object} this */
    zeroOrMore: function() { parts.push("*"); return b; },
    /** Numbered capturing group. @param {Object|string} content @returns {Object} this */
    capture: function(content) { parts.push("(" + extractInner(content) + ")"); return b; },
    /** Named capture group (?<name>...). @param {string} name @param {Object|string} content @returns {Object} this
     * @example forge().namedCapture("year", forge().digits(4)).build() */
    namedCapture: function(name, content) {
      if (!name) throw new Error("namedCapture requires a non-empty name");
      parts.push("(?<" + name + ">" + extractInner(content) + ")"); return b;
    },
    /** Non-capturing group (?:...). @param {Object|string} content @returns {Object} this */
    group: function(content) { parts.push("(?:" + extractInner(content) + ")"); return b; },
    /** Alternation (OR). @param {...Object|string} alternatives @returns {Object} this
     * @example forge().or(forge().literal("cat"), forge().literal("dog")).build() */
    or: function() {
      var alts = [];
      for (var i = 0; i < arguments.length; i++) alts.push(extractInner(arguments[i]));
      parts.push("(?:" + alts.join("|") + ")"); return b;
    },
    /** Positive lookahead (?=...). @param {Object|string} content @returns {Object} this */
    followedBy: function(content) { parts.push("(?=" + extractInner(content) + ")"); return b; },
    /** Negative lookahead (?!...). @param {Object|string} content @returns {Object} this */
    notFollowedBy: function(content) { parts.push("(?!" + extractInner(content) + ")"); return b; },
    /** Word boundary assertion (\b). @returns {Object} this */
    boundary: function() { parts.push("\\b"); return b; },
    /** Set regex flags (g, i, m, s, u). @param {string} flagStr @returns {Object} this */
    withFlags: function(flagStr) { flags = String(flagStr); return b; },
    /** Build final RegExp. @returns {RegExp} */
    build: function() { return new RegExp(parts.join(""), flags); },
    /** Get pattern string "/pattern/flags". @returns {string} */
    toString: function() { return "/" + parts.join("") + "/" + flags; },
    /** @private */
    _getParts: function() { return parts; }
  };
  return b;
}

/** Pre-built validators for common formats. Each returns a RegExp.
 * @example if (patterns.email().test(input)) console.log("Valid email"); */
var patterns = {
  /** RFC 5322 simplified email. @returns {RegExp} */
  email: function() { return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/; },
  /** URL with http/https. @returns {RegExp} */
  url: function() { return /^https?:\/\/[^\s/$.?#].[^\s]*$/i; },
  /** IPv4 with octet range 0-255. @returns {RegExp} */
  ipv4: function() { return /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/; },
  /** US phone: (xxx) xxx-xxxx, xxx-xxx-xxxx, +1 prefix. @returns {RegExp} */
  usPhone: function() { return /^(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/; },
  /** ISO 8601 date YYYY-MM-DD. @returns {RegExp} */
  isoDate: function() { return /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/; },
  /** CSS hex color #RGB or #RRGGBB. @returns {RegExp} */
  hexColor: function() { return /^#(?:[0-9a-fA-F]{3}){1,2}$/; },
  /** Semantic version major.minor.patch[-pre][+build]. @returns {RegExp} */
  semver: function() { return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?$/; },
  /** UUID v4. @returns {RegExp} */
  uuid: function() { return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i; },
  /** Strong password: 8+ chars, upper+lower+digit+special. @returns {RegExp} */
  strongPassword: function() { return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]).{8,}$/; },
  /** Credit card: Visa, MC, Amex, Discover. @returns {RegExp} */
  creditCard: function() { return /^(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12})$/; },
  /** URL-friendly slug. @returns {RegExp} */
  slug: function() { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/; },
  /** JWT three-segment format. @returns {RegExp} */
  jwt: function() { return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/; }
};

/**
 * Generates plain-English explanation of any regex pattern.
 * @param {RegExp|string} regex - Pattern to explain
 * @returns {Object} { pattern, flags, flagMeaning, explanation: string[], summary }
 * @example
 * explain(/^[a-z]+@[a-z]+\.[a-z]{2,}$/i).explanation.forEach(l => console.log(l));
 * // "^ — Start of string/line"
 * // "[a-z]+ — One or more characters in: a-z"
 */
function explain(regex) {
  if (!regex) throw new Error("explain() requires a RegExp or pattern string");
  var source = regex instanceof RegExp ? regex.source : String(regex);
  var flagStr = regex instanceof RegExp ? regex.flags : "";
  var tokens = tokenize(source);
  var lines = [];
  var FLAG_MAP = { g: "global", i: "case-insensitive", m: "multiline", s: "dotAll", u: "unicode" };
  for (var ti = 0; ti < tokens.length; ti++) {
    var desc = describeToken(tokens[ti]);
    if (desc) lines.push(tokens[ti] + " — " + desc);
  }
  return {
    pattern: source, flags: flagStr,
    flagMeaning: flagStr.split("").map(function(f) { return FLAG_MAP[f] || f; }),
    explanation: lines,
    summary: lines.length + " components" + (flagStr ? " [" + flagStr + "]" : "")
  };
}

function tokenize(source) {
  var tokens = [], pos = 0;
  while (pos < source.length) {
    var ch = source[pos];
    if (ch === "\\") { tokens.push(source.slice(pos, pos + 2)); pos += 2; }
    else if (ch === "[") {
      var classEnd = pos + 1;
      while (classEnd < source.length && source[classEnd] !== "]") { if (source[classEnd] === "\\") classEnd++; classEnd++; }
      tokens.push(source.slice(pos, classEnd + 1)); pos = classEnd + 1;
    } else if (ch === "(") {
      var groupEnd = pos, depth = 0;
      do { if (source[groupEnd] === "\\") groupEnd++; else if (source[groupEnd] === "(") depth++; else if (source[groupEnd] === ")") depth--; groupEnd++; } while (depth > 0 && groupEnd < source.length);
      tokens.push(source.slice(pos, groupEnd)); pos = groupEnd;
    } else if (ch === "{") {
      var braceEnd = source.indexOf("}", pos);
      if (braceEnd > pos) { tokens.push(source.slice(pos, braceEnd + 1)); pos = braceEnd + 1; }
      else { tokens.push(ch); pos++; }
    } else { tokens.push(ch); pos++; }
  }
  return tokens;
}

function describeToken(token) {
  var MAP = { "^": "Start of string/line", "$": "End of string/line", ".": "Any character except newline",
    "\\d": "Any digit (0-9)", "\\D": "Any non-digit", "\\w": "Word character (a-z, A-Z, 0-9, _)",
    "\\W": "Non-word character", "\\s": "Whitespace (space, tab, newline)", "\\S": "Non-whitespace",
    "\\b": "Word boundary", "+": "One or more of previous", "*": "Zero or more of previous", "?": "Optional (zero or one)" };
  if (MAP[token]) return MAP[token];
  if (token.match(/^\{(\d+)\}$/)) return "Exactly " + RegExp.$1 + " of previous";
  if (token.match(/^\{(\d+),(\d*)\}$/)) return "Between " + RegExp.$1 + " and " + (RegExp.$2 || "unlimited") + " of previous";
  if (token.startsWith("[^")) return "Not in: " + token.slice(2, -1);
  if (token.startsWith("[")) return "Any of: " + token.slice(1, -1);
  if (token.startsWith("(?<")) { var nm = token.match(/\?<([^>]+)>/); return "Named capture '" + (nm ? nm[1] : "") + "'"; }
  if (token.startsWith("(?=")) return "Lookahead: must be followed by " + token.slice(3, -1);
  if (token.startsWith("(?!")) return "Negative lookahead: not followed by " + token.slice(3, -1);
  if (token.startsWith("(?:")) return "Non-capturing group: " + token.slice(3, -1);
  if (token.startsWith("(")) return "Capture group: " + token.slice(1, -1);
  if (token.startsWith("\\")) return "Literal '" + token[1] + "'";
  if (token.length === 1 && /[a-zA-Z0-9]/.test(token)) return "Literal '" + token + "'";
  return null;
}

/**
 * Tests a regex against multiple inputs with detailed match results.
 * @param {RegExp} regex - Pattern to test
 * @param {string[]} inputs - Strings to match against
 * @returns {Object} { pattern, total, matched, results: [{input, matched, fullMatch, groups, namedGroups, index, executionMs}] }
 * @example
 * testPattern(/(\d{3})-(\d{4})/, ["555-1234", "hello"])
 * // { matched: 1, results: [{input:"555-1234", matched:true, groups:["555","1234"]}, ...] }
 */
function testPattern(regex, inputs) {
  if (!(regex instanceof RegExp)) throw new TypeError("testPattern() expects RegExp as first argument");
  if (!Array.isArray(inputs)) throw new TypeError("testPattern() expects array as second argument");
  var results = [];
  for (var idx = 0; idx < inputs.length; idx++) {
    var testStr = String(inputs[idx]);
    var startTime = Date.now();
    var match = testStr.match(regex);
    var elapsed = Date.now() - startTime;
    results.push({
      input: testStr, matched: !!match,
      fullMatch: match ? match[0] : null,
      groups: match ? match.slice(1) : [],
      namedGroups: match && match.groups ? match.groups : {},
      index: match ? match.index : -1,
      executionMs: elapsed
    });
  }
  var matchCount = results.filter(function(r) { return r.matched; }).length;
  return { pattern: regex.toString(), total: inputs.length, matched: matchCount, results: results };
}

/**
 * Detects regex anti-patterns: catastrophic backtracking, greedy traps, ReDoS risks.
 * @param {RegExp|string} regex - Pattern to analyze
 * @returns {Object} { safe: boolean, riskLevel: "low"|"medium"|"high", warnings: [{severity, issue, suggestion}] }
 * @example
 * detectAntiPatterns(/(a+)+$/)
 * // { safe: false, riskLevel: "high", warnings: [{severity:"CRITICAL", ...}] }
 */
function detectAntiPatterns(regex) {
  if (!regex) throw new Error("detectAntiPatterns() requires a RegExp or pattern string");
  var source = regex instanceof RegExp ? regex.source : String(regex);
  var warnings = [];

  if (/([\+\*])\)[\+\*]/.test(source) || /(\+\+|\*\*)/.test(source)) {
    warnings.push({ severity: "CRITICAL", issue: "Catastrophic backtracking — nested quantifiers detected", suggestion: "Refactor nested quantifiers: (a+)+ → a+. Prevents ReDoS vulnerability." });
  }
  if (/^(?!\^).*\.\*/.test(source) && !source.startsWith("^")) {
    warnings.push({ severity: "WARNING", issue: "Greedy .* without start anchor", suggestion: "Add ^ anchor or use .*? (lazy) for predictable matching." });
  }
  var dotCount = 0, inClass = false;
  for (var ci = 0; ci < source.length; ci++) {
    if (source[ci] === "\\") { ci++; continue; }
    if (source[ci] === "[") inClass = true;
    if (source[ci] === "]") inClass = false;
    if (source[ci] === "." && !inClass) dotCount++;
  }
  if (dotCount > 3) {
    warnings.push({ severity: "INFO", issue: dotCount + " unescaped dots — may match unexpected chars", suggestion: "Use specific character classes like [a-zA-Z] instead of '.' for stricter matching." });
  }
  if (/\|{2}|\(\||\|\)/.test(source)) {
    warnings.push({ severity: "WARNING", issue: "Empty alternation branch — matches empty string", suggestion: "Remove empty alternative or use ? for optional match." });
  }
  if (/\[.*[A-Z]-[a-z]/.test(source)) {
    warnings.push({ severity: "INFO", issue: "Suspicious range in character class (A-z includes extra chars)", suggestion: "Use [A-Za-z] instead of [A-z]." });
  }
  var critCount = warnings.filter(function(w) { return w.severity === "CRITICAL"; }).length;
  var warnCount = warnings.filter(function(w) { return w.severity === "WARNING"; }).length;
  return { safe: critCount === 0, riskLevel: critCount > 0 ? "high" : warnCount > 0 ? "medium" : "low", warnings: warnings };
}

/**
 * Suggests concrete optimizations for a regex pattern.
 * @param {RegExp|string} regex - Pattern to analyze
 * @returns {Object} { original, optimized: boolean, suggestions: string[] }
 * @example
 * optimize(/[0-9][a-zA-Z0-9_]+/).suggestions
 * // ["Replace [0-9] with \\d", "Replace [a-zA-Z0-9_] with \\w"]
 */
function optimize(regex) {
  if (!regex) throw new Error("optimize() requires a RegExp or pattern string");
  var source = regex instanceof RegExp ? regex.source : String(regex);
  var suggestions = [];
  if (/\[0-9\]/.test(source)) suggestions.push("Replace [0-9] with \\d — shorter and clearer.");
  if (/\[a-zA-Z0-9_\]/.test(source)) suggestions.push("Replace [a-zA-Z0-9_] with \\w — equivalent shorthand.");
  if (/\[a-zA-Z\]/.test(source) && !(regex instanceof RegExp && regex.flags.includes("i")))
    suggestions.push("Consider /i flag instead of [a-zA-Z] for case-insensitive matching.");
  if (/\.\*$/.test(source)) suggestions.push("Trailing .* is often unnecessary — matches remainder without useful capture.");
  if (source.length > 80) suggestions.push("Complex pattern (" + source.length + " chars). Compose from sub-patterns with forge() for readability.");
  var caps = source.match(/(?:[^\\]|^)\((?!\?)/g);
  if (caps && caps.length > 3) suggestions.push(caps.length + " capture groups found. Use (?:...) for non-extracting groups.");
  return { original: source, optimized: suggestions.length > 0, suggestions: suggestions };
}

console.log("RegexForge v2 — Fluent Regex Builder & Pattern Intelligence\n");
var ph = forge().startOfLine().optional(forge().literal("(")).digits(3).optional(forge().literal(")")).anyOf(" -.").digits(3).anyOf(" -.").digits(4).endOfLine().build();
console.log("Phone: " + ph + " | test: " + ph.test("(555) 123-4567"));
var sv = forge().startOfLine().namedCapture("major", forge().digit().oneOrMore()).literal(".").namedCapture("minor", forge().digit().oneOrMore()).literal(".").namedCapture("patch", forge().digit().oneOrMore()).endOfLine().build();
console.log("Semver parse: " + JSON.stringify("1.2.3".match(sv).groups));
console.log("Email valid: " + patterns.email().test("user@example.com"));
console.log("Explain: " + explain(/^\d+$/).explanation.join(", "));
var d = detectAntiPatterns(/(a+)+$/);
console.log("Anti-pattern: " + d.warnings[0].severity + " — " + d.warnings[0].issue);
console.log("Optimize: " + optimize(/[0-9]+/).suggestions[0]);

module.exports = { forge: forge, patterns: patterns, explain: explain, testPattern: testPattern, detectAntiPatterns: detectAntiPatterns, optimize: optimize, escapeRegex: escapeRegex };
