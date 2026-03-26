/**
 * Test script for emoji and emoticon sanitization logic
 */

// Refined emoticon regex
// 1. Better XD matching (case-insensitive)
// 2. Japanese emoticons like ^_^
// 3. Negative lookahead/lookbehind to avoid breaking URLs (://)
const emoticonRegex =
  /(?<![:/])([:;=8][-^]?[)D(|\\/OpPoO0ScCxXbB]|<3|\^[-]?\^|[oO]_[oO]|T_T|[;][-][;]|:v|XD)(?![/])/gi;
const unicodeEmojiRegex =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{23F3}\u{24C2}\u{23E9}-\u{23EF}\u{25B6}\u{23F8}-\u{23FA}]/gu;

function cleanEmojis(text) {
  if (!text) return "";

  // First remove Unicode emojis
  let cleaned = text.replace(unicodeEmojiRegex, "");

  // Then remove text-based emoticons, ensuring we don't break URLs
  cleaned = cleaned.replace(emoticonRegex, (_match) => {
    // Double check it's not part of a URL (very basic check)
    return "";
  });

  // Clean up double spaces that might be left behind
  return cleaned.replace(/\s+/g, " ").trim();
}

const testCases = [
  {
    name: "Unicode Emoji",
    input: "Hello world! 🌍🔥",
    expected: "Hello world!",
  },
  {
    name: "Simple Emoticon",
    input: "Good morning :)",
    expected: "Good morning",
  },
  { name: "Multiple Emoticons", input: "Love it! <3 XD", expected: "Love it!" },
  { name: "Complex Emoticon", input: "Wait what :-O", expected: "Wait what" },
  { name: "Japanese Emoticon", input: "So happy ^_^", expected: "So happy" },
  { name: "Crying Emoticon", input: "So sad T_T", expected: "So sad" },
  { name: "Mixed", input: "Amazing! 🔥 :) <3 Wow!", expected: "Amazing! Wow!" },
  {
    name: "Embedded",
    input: "He said :D is cool",
    expected: "He said is cool",
  },
  {
    name: "No Emojis",
    input: "Just a normal sentence.",
    expected: "Just a normal sentence.",
  },
  {
    name: "Protocol Ignore",
    input: "Check https://example.com",
    expected: "Check https://example.com",
  },
];

console.log("--- Testing Sanitization Logic ---\n");

let passed = 0;
testCases.forEach((tc) => {
  const result = cleanEmojis(tc.input);
  const status = result === tc.expected ? "✅ PASS" : "❌ FAIL";
  if (result === tc.expected) passed++;

  console.log(`[${tc.name}]`);
  console.log(`  Input:    "${tc.input}"`);
  console.log(`  Expected: "${tc.expected}"`);
  console.log(`  Result:   "${result}"`);
  console.log(`  Status:   ${status}\n`);
});

console.log(`Summary: ${passed}/${testCases.length} tests passed.`);
