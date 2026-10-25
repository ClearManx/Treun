# Treun

**An agent-enabled procurement ledger for cross-border defence supply.**

Built at the Oxford and Cambridge AI Race (25 October 2026).

## The problem

Frontline units often wait months for equipment they need now. Cross-border defence procurement runs through slow approval chains and a few intermediaries, which delays delivery, raises prices and makes corruption hard to detect. Suppliers who could deliver fast can't reach the units that need them.

## What Treun does

A unit's buyer agent takes a plain-language request, calls tools to look up suppliers and prices, checks budget and licence constraints, and pays the supplier directly in USDC on Solana. Every order and payment is recorded on-chain, so speed doesn't come at the cost of accountability.

- **Fast:** USDC settles in seconds, across borders, with no correspondent banks.
- **Controlled:** hard per-payment and total budget caps are enforced in code before anything is signed.
- **Auditable:** every payment has a public, timestamped transaction that neither buyer nor seller can edit.

## What works today

Verified live by the AI Race verifier, which sends fresh inputs on every attempt:

| Capability | Status |
| --- | --- |
| Answers questions with an LLM | Verified |
| Calls real tools and computes answers from their results | Verified |
| Pays a given address in devnet USDC with a memo, returning the transaction signature | Verified on-chain |
| Structured output, source-grounded answers with citations, per-session memory | Implemented, not yet verified |
| Procurement catalogue and audit interface | In progress |

## Architecture

- **App:** Next.js 16 (App Router, TypeScript).
- **Agent:** a tool-calling loop. The model chooses tools; the app calls them for real. Numbers are computed by the app from arithmetic expressions the model writes, not by the model, to avoid calculation errors. Tool calls retry transient failures with backoff.
- **Model:** OpenAI GPT mini-class model (Gemini fallback), capped in tokens and time per call.
- **Payments:** Solana devnet. Direct USDC transfers with a memo (`@solana/kit`, SPL Token) and x402 HTTP payments for paid APIs.
- **Spending controls:** per-payment and total budget caps checked before signing.

Key files: `lib/race/handlers.ts` (agent logic), `lib/ai/llm.ts` (model client), `lib/payments/transfer.ts` (USDC transfers), `lib/spending/` (limits).

## Run it

Requires Node.js 20.9+.

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

In `.env.local`:

- `OPENAI_API_KEY` (or `GEMINI_API_KEY`) for the model
- `PAY_TO_ADDRESS` and `AGENT_PRIVATE_KEY`: run `npm run keygen -- --pay-to` and `npm run keygen`
- Fund both wallets with devnet USDC (faucet.circle.com, Solana Devnet) and the agent wallet with devnet SOL for fees; check with `npm run wallets`

**Devnet only.** Treun uses test money and refuses any other network. Never use a key that holds real funds.

## Scope and limits

This is a hackathon prototype. Suppliers and products are fictional; licence checks are simulated; it is not connected to any real procurement system. In production, sensitive order details would stay encrypted off-chain with only hashes recorded on-chain.

---

Generated from the Superteam Agent Studio starter (x402 payments, spending controls, AI Race adapter).
