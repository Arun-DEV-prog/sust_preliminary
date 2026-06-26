const https = require("https");

function extractJsonFromText(text) {
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (_error) {
      return null;
    }
  }

  try {
    return JSON.parse(text.trim());
  } catch (_error) {
    return null;
  }
}

function buildFallbackAnalysisPayload({ customerInput, ticketId }) {
  return {
    ticket_id: ticketId || `chat-${Date.now()}`,
    complaint: customerInput || "",
    transaction_history: [],
  };
}

function callGeminiForAnalysis({ customerInput, ticketId, apiKey }) {
  if (!apiKey) {
    return Promise.resolve({
      ok: false,
      error: "missing_api_key",
      payload: buildFallbackAnalysisPayload({ customerInput, ticketId }),
    });
  }

  const prompt = [
    "You are a fintech support investigator.",
    "Return ONLY valid JSON with keys: ticket_id, complaint, transaction_history, language, channel, user_type, metadata.",
    "If transaction history is unavailable, use an empty array.",
    `Customer message: ${customerInput}`,
  ].join("\n");

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(raw);
            const text =
              parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const payload =
              extractJsonFromText(text) ||
              buildFallbackAnalysisPayload({ customerInput, ticketId });
            resolve({ ok: true, payload });
          } catch (_error) {
            resolve({
              ok: false,
              error: "invalid_response",
              payload: buildFallbackAnalysisPayload({
                customerInput,
                ticketId,
              }),
            });
          }
        });
      },
    );

    req.on("error", () => {
      resolve({
        ok: false,
        error: "request_failed",
        payload: buildFallbackAnalysisPayload({ customerInput, ticketId }),
      });
    });

    req.write(body);
    req.end();
  });
}

module.exports = {
  extractJsonFromText,
  buildFallbackAnalysisPayload,
  callGeminiForAnalysis,
};
