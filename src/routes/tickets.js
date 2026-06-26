const express = require("express");
const { analyzeTicket } = require("../services/ticketAnalyzer");
const { prisma } = require("../config/prisma");
const {
  callGeminiForAnalysis,
  buildFallbackAnalysisPayload,
} = require("../services/geminiService");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.post("/analyze-ticket", async (req, res) => {
  try {
    const result = analyzeTicket(req.body);

    try {
      await prisma.ticketAnalysis.create({
        data: {
          ticketId: result.ticket_id,
          relevantTransactionId: result.relevant_transaction_id,
          evidenceVerdict: result.evidence_verdict,
          caseType: result.case_type,
          severity: result.severity,
          department: result.department,
          confidence: result.confidence,
          humanReviewRequired: result.human_review_required,
        },
      });
    } catch (dbError) {
      console.warn("Prisma persistence skipped:", dbError.message);
    }

    res.json(result);
  } catch (error) {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON payload." });
    }

    if (error?.name === "ZodError") {
      const issues = error.issues || [];
      const isSemanticIssue = issues.some(
        (issue) => issue.code === "too_small",
      );
      const statusCode = isSemanticIssue ? 422 : 400;
      return res.status(statusCode).json({ error: "Invalid request payload." });
    }

    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/chatbot/analyze", async (req, res) => {
  try {
    const { customer_input, ticket_id, metadata } = req.body || {};
    const customerInput =
      typeof customer_input === "string" ? customer_input : "";
    const ticketId =
      typeof ticket_id === "string" && ticket_id.trim() ? ticket_id : undefined;

    const geminiResult = await callGeminiForAnalysis({
      customerInput,
      ticketId,
      apiKey: process.env.GEMINI_API_KEY,
    });

    const normalizedPayload =
      geminiResult?.payload ||
      buildFallbackAnalysisPayload({ customerInput, ticketId });
    const payload = {
      ...normalizedPayload,
      metadata: {
        ...normalizedPayload.metadata,
        ...metadata,
        source: "gemini_chatbot",
      },
    };

    const result = analyzeTicket(payload);

    try {
      await prisma.ticketAnalysis.create({
        data: {
          ticketId: result.ticket_id,
          relevantTransactionId: result.relevant_transaction_id,
          evidenceVerdict: result.evidence_verdict,
          caseType: result.case_type,
          severity: result.severity,
          department: result.department,
          confidence: result.confidence,
          humanReviewRequired: result.human_review_required,
        },
      });
    } catch (dbError) {
      console.warn("Prisma persistence skipped:", dbError.message);
    }

    res.json({
      ...result,
      gemini_used: Boolean(process.env.GEMINI_API_KEY),
      gemini_status: geminiResult?.ok
        ? "ok"
        : geminiResult?.error || "fallback",
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
