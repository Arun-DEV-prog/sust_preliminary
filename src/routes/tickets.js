const express = require("express");
const { analyzeTicket } = require("../services/ticketAnalyzer");
const { prisma } = require("../config/prisma");

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

module.exports = router;
