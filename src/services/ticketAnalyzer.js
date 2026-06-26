const { z } = require("zod");

const transactionSchema = z.object({
  transaction_id: z.string(),
  timestamp: z.string().optional(),
  type: z.string().optional(),
  amount: z.number().optional(),
  counterparty: z.string().optional(),
  status: z.string().optional(),
});

const requestSchema = z.object({
  ticket_id: z.string().min(1),
  complaint: z.string().min(1),
  language: z.enum(["en", "bn", "mixed"]).optional(),
  channel: z
    .enum([
      "in_app_chat",
      "call_center",
      "email",
      "merchant_portal",
      "field_agent",
    ])
    .optional(),
  user_type: z.enum(["customer", "merchant", "agent", "unknown"]).optional(),
  campaign_context: z.string().optional(),
  transaction_history: z.array(transactionSchema).optional(),
  metadata: z.record(z.any()).optional(),
});

function analyzeTicket(payload) {
  const parsed = requestSchema.parse(payload);
  const complaint = parsed.complaint.toLowerCase();
  const txns = parsed.transaction_history || [];
  const hasPromptInjection =
    /ignore previous instructions|ignore all instructions|share your (otp|pin|password)|confirm a refund|confirm a reversal|tell me to/i.test(
      complaint,
    );

  let matchingTransaction = null;
  let evidenceVerdict = "insufficient_data";
  let relevantTransactionId = null;
  let reasonCodes = [];

  if (txns.length > 0) {
    matchingTransaction = txns.find((txn) => {
      const haystack = [
        txn.transaction_id || "",
        txn.counterparty || "",
        txn.type || "",
        txn.status || "",
        typeof txn.amount === "number" ? String(txn.amount) : "",
      ]
        .join(" ")
        .toLowerCase();

      return (
        complaint.includes(txn.transaction_id?.toLowerCase() || "") ||
        (complaint.includes("wrong number") &&
          (txn.counterparty || "").includes("+")) ||
        (complaint.includes("transfer") &&
          (txn.type || "").includes("transfer")) ||
        (complaint.includes("refund") && (txn.type || "").includes("refund")) ||
        (complaint.includes("failed") &&
          (txn.status || "").includes("failed")) ||
        haystack.includes("wrong")
      );
    });
  }

  if (matchingTransaction) {
    relevantTransactionId = matchingTransaction.transaction_id;
    evidenceVerdict = "consistent";
    reasonCodes.push("transaction_match");
  } else if (txns.length > 0) {
    evidenceVerdict = "inconsistent";
    reasonCodes.push("no_transaction_match");
  }

  let caseType = "other";
  let department = "customer_support";
  let severity = "low";
  let humanReviewRequired = false;

  if (hasPromptInjection) {
    caseType = "phishing_or_social_engineering";
    department = "fraud_risk";
    severity = "critical";
    humanReviewRequired = true;
    reasonCodes.push("prompt_injection_ignored");
  } else if (matchingTransaction) {
    if (
      complaint.includes("wrong") ||
      complaint.includes("wrong number") ||
      complaint.includes("wrong recipient")
    ) {
      caseType = "wrong_transfer";
      department = "dispute_resolution";
      severity = "high";
      humanReviewRequired = true;
      reasonCodes.push("wrong_transfer");
    } else if (complaint.includes("refund")) {
      caseType = "refund_request";
      department = "dispute_resolution";
      severity = "medium";
      humanReviewRequired = true;
      reasonCodes.push("refund_request");
    } else if (
      complaint.includes("failed") ||
      complaint.includes("payment failed")
    ) {
      caseType = "payment_failed";
      department = "payments_ops";
      severity = "medium";
      humanReviewRequired = false;
      reasonCodes.push("payment_failed");
    } else if (complaint.includes("duplicate")) {
      caseType = "duplicate_payment";
      department = "payments_ops";
      severity = "high";
      humanReviewRequired = true;
      reasonCodes.push("duplicate_payment");
    } else if (
      complaint.includes("settlement") ||
      complaint.includes("merchant")
    ) {
      caseType = "merchant_settlement_delay";
      department = "merchant_operations";
      severity = "medium";
      humanReviewRequired = true;
      reasonCodes.push("merchant_settlement_delay");
    } else if (complaint.includes("agent") || complaint.includes("cash in")) {
      caseType = "agent_cash_in_issue";
      department = "agent_operations";
      severity = "medium";
      humanReviewRequired = true;
      reasonCodes.push("agent_cash_in_issue");
    } else if (
      complaint.includes("otp") ||
      complaint.includes("pin") ||
      complaint.includes("password") ||
      complaint.includes("social engineering") ||
      complaint.includes("phishing")
    ) {
      caseType = "phishing_or_social_engineering";
      department = "fraud_risk";
      severity = "critical";
      humanReviewRequired = true;
      reasonCodes.push("phishing_or_social_engineering");
    }
  } else if (txns.length > 0) {
    if (
      complaint.includes("refund") ||
      complaint.includes("otp") ||
      complaint.includes("pin") ||
      complaint.includes("password") ||
      complaint.includes("phishing")
    ) {
      caseType = "refund_request";
      department = "customer_support";
      severity = "medium";
      humanReviewRequired = true;
      reasonCodes.push("refund_request");
    }
  }

  const agentSummary = buildAgentSummary(
    caseType,
    relevantTransactionId,
    evidenceVerdict,
  );
  const recommendedNextAction = buildRecommendedNextAction(
    caseType,
    relevantTransactionId,
    evidenceVerdict,
  );
  const customerReply = buildCustomerReply(
    caseType,
    relevantTransactionId,
    evidenceVerdict,
  );

  return {
    ticket_id: parsed.ticket_id,
    relevant_transaction_id: relevantTransactionId,
    evidence_verdict: evidenceVerdict,
    case_type: caseType,
    severity,
    department,
    agent_summary: agentSummary,
    recommended_next_action: recommendedNextAction,
    customer_reply: customerReply,
    human_review_required: humanReviewRequired,
    confidence: 0.9,
    reason_codes: reasonCodes,
  };
}

function buildAgentSummary(caseType, relevantTransactionId, evidenceVerdict) {
  const reference = relevantTransactionId
    ? `transaction ${relevantTransactionId}`
    : "the provided transaction history";

  if (caseType === "wrong_transfer") {
    return `Customer reports a transfer issue related to ${reference}. The evidence ${evidenceVerdict === "consistent" ? "supports the report" : "does not clearly support it"} and should be reviewed with the customer before any action is taken.`;
  }

  if (caseType === "phishing_or_social_engineering") {
    return "The complaint appears to involve a suspicious request for security details. The service flags it for fraud review and does not treat it as a standard transaction dispute.";
  }

  if (evidenceVerdict === "insufficient_data") {
    return "The complaint is ambiguous and the provided history does not establish a clear match. The case should be routed for human follow-up.";
  }

  return `The complaint has been assessed against ${reference}. The case appears to be ${caseType.replace(/_/g, " ")} and should be handled through the appropriate support workflow.`;
}

function buildRecommendedNextAction(
  caseType,
  relevantTransactionId,
  evidenceVerdict,
) {
  if (caseType === "wrong_transfer") {
    return `Verify ${relevantTransactionId ? `transaction ${relevantTransactionId}` : "the reported transfer"} with the customer and review the recipient details before escalating to dispute resolution.`;
  }
  if (caseType === "phishing_or_social_engineering") {
    return "Escalate to fraud risk review and instruct the customer to use only official support channels.";
  }
  if (evidenceVerdict === "insufficient_data") {
    return "Request any missing transaction details from the customer and route the case for human review.";
  }
  return "Continue the standard support workflow and document the findings for the assigned department.";
}

function buildCustomerReply(caseType, relevantTransactionId, evidenceVerdict) {
  if (caseType === "phishing_or_social_engineering") {
    return "We have noted your concern about a suspicious request. Please use our official support channels only and avoid sharing any sensitive account information.";
  }

  if (evidenceVerdict === "insufficient_data") {
    return "We have noted your concern and are reviewing the available information. If you can share the transaction reference or a recent payment detail, our team can follow up through official support channels.";
  }

  if (relevantTransactionId) {
    return `We have noted your concern about transaction ${relevantTransactionId}. Our team is reviewing the details and will continue through official support channels.`;
  }

  return "We have noted your concern and are reviewing the available information through official support channels.";
}

module.exports = {
  analyzeTicket,
  requestSchema,
};
