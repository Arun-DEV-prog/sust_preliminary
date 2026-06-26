# Mock Sust Support Copilot API

A lightweight fintech support investigation service that analyzes a customer complaint together with recent transaction history, classifies the case, routes it to the correct department, and returns a safe customer-facing response for support agents.

## Tech stack

- Node.js + Express for the API layer
- Prisma + PostgreSQL for persistence
- Zod for request validation
- Node.js built-in test runner for regression tests

## Models and AI approach

This solution uses a deterministic rule-based investigation engine instead of a remote LLM call.

- Model choice: no external model is required for the current version
- Why this choice: fast, transparent, low-cost, and safer for a hackathon-style evaluation environment
- What it evaluates: complaint intent, transaction evidence, risk signals, and routing logic

## Safety logic

The service is designed to avoid unsafe support behavior:

- It never requests PINs, OTPs, or passwords in the customer reply
- It never confirms refunds or reversals it has no authority to confirm
- It never instructs the customer to contact suspicious or third-party numbers
- It detects prompt-injection attempts such as “ignore previous instructions” and escalates them as high-risk cases

## Limitations

- The current analyzer is rule-based and intentionally conservative
- It may miss nuanced cases that require deeper conversational context
- Ambiguous or high-risk cases are routed for human review rather than being handled automatically

## API contract

- GET /health
- POST /analyze-ticket

## Live demo

- Health check: https://mock-sust-edg0rxlmf-arun-kumar-roys-projects.vercel.app/health

## Run locally

```bash
npm install
npm test
npm start
```

## Example request

```bash
curl -X POST http://localhost:3000/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TKT-001",
    "complaint": "I sent 5000 taka to a wrong number around 2pm today.",
    "language": "en",
    "channel": "in_app_chat",
    "user_type": "customer",
    "transaction_history": [
      {
        "transaction_id": "TXN-9101",
        "timestamp": "2026-04-14T14:08:22Z",
        "type": "transfer",
        "amount": 5000,
        "counterparty": "+8801719876543",
        "status": "completed"
      }
    ]
  }'
```

## Sample output

See [sample-output.json](sample-output.json).

## Environment variables

Copy [.env.example](.env.example) to .env and adjust values as needed.

## Docker

```bash
docker build -t mock-sust .
docker run -p 3000:3000 --env-file .env mock-sust
```

## Deployment notes

This service is designed for a small VM or container environment. The current version is intentionally lightweight and deterministic so it is easy to run and reliable under evaluation.
