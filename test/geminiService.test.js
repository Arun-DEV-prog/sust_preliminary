const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractJsonFromText,
  buildFallbackAnalysisPayload,
} = require("../src/services/geminiService");

test("extracts JSON from a fenced Gemini response", () => {
  const parsed = extractJsonFromText(
    `Here is the result:\n\n\`\`\`json\n{"ticket_id":"chat-1","complaint":"I sent money to the wrong person"}\n\`\`\``,
  );

  assert.deepEqual(parsed, {
    ticket_id: "chat-1",
    complaint: "I sent money to the wrong person",
  });
});

test("builds a fallback payload from customer input", () => {
  const payload = buildFallbackAnalysisPayload({
    customerInput: "I need help with a payment issue",
    ticketId: "chat-2",
  });

  assert.equal(payload.ticket_id, "chat-2");
  assert.equal(payload.complaint, "I need help with a payment issue");
  assert.deepEqual(payload.transaction_history, []);
});
