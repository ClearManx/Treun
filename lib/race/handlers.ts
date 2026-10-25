// Treun race logic. One function per ASRP/1 task type. adapter.ts handles auth, nonce and envelope.
import { TaskError, type Task, type TaskOutput, type TaskRequest, type TaskType, type ToolSpec } from "./protocol";
import { callTool, searchSource, ToolCallError } from "./tools";
import { memory } from "./memory";
import { askJson, askLlm, type ChatTurn } from "../ai/llm";
import { loadAgentSigner } from "../payments/client";
import { payUsdc } from "../payments/transfer";

type Handler = (task: Task, request: TaskRequest) => Promise<TaskOutput>;

const inputText = (task: Task): string =>
  typeof task.input === "string" ? task.input : JSON.stringify(task.input ?? "");

function requireInput(task: Task): string {
  const text = inputText(task).trim();
  if (!text || text === '""' || text === "{}") throw new TaskError("invalid_input", "Task input is missing or empty.");
  return text;
}

// ---- Reliable tool calls: retry transient failures, map errors to protocol codes -------------
async function reliableCall(tool: ToolSpec, task: Task, input: Record<string, unknown>): Promise<unknown> {
  const attempts = 4;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callTool(tool, task, input);
    } catch (e) {
      last = e;
      if (e instanceof ToolCallError) {
        // 4xx (except 408/429) won't fix itself: stop retrying.
        if (e.httpStatus !== null && e.httpStatus >= 400 && e.httpStatus < 500 && e.httpStatus !== 408 && e.httpStatus !== 429) {
          throw new TaskError("invalid_input", e.message);
        }
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 300 * 2 ** i));
        continue;
      }
      throw e;
    }
  }
  if (last instanceof ToolCallError) {
    const timedOut = last.httpStatus === null && /did not answer|timeout|timed out/i.test(last.message);
    throw new TaskError(timedOut || last.httpStatus === 504 ? "upstream_timeout" : "upstream_unavailable", last.message);
  }
  throw new TaskError("upstream_unavailable", last instanceof Error ? last.message : "tool failed");
}

// ---- Generic agent loop: the model picks tools, we call them for real -------------------------
/** Evaluates simple arithmetic (numbers, + - * / and parentheses) without eval. */
function evalArith(expr: string): number {
  const s = expr.replace(/,/g, "").replace(/\s+/g, "");
  if (!/^[\d.+\-*/()eE]+$/.test(s)) throw new Error(`bad expression: ${expr}`);
  let i = 0;
  const num = (): number => {
    if (s[i] === "(") { i++; const v = add(); i++; return v; }
    if (s[i] === "-") { i++; return -num(); }
    const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(s.slice(i));
    if (!m) throw new Error(`bad number in: ${expr}`);
    i += m[0].length;
    return Number(m[0]);
  };
  const mul = (): number => { let v = num(); while (s[i] === "*" || s[i] === "/") { const op = s[i++]; const r = num(); v = op === "*" ? v * r : v / r; } return v; };
  const add = (): number => { let v = mul(); while (s[i] === "+" || s[i] === "-") { const op = s[i++]; const r = mul(); v = op === "+" ? v + r : v - r; } return v; };
  const v = add();
  if (i !== s.length) throw new Error(`could not parse: ${expr}`);
  return v;
}

function applyCalc(data: unknown, calc: Record<string, string> | undefined): unknown {
  if (!calc || typeof calc !== "object") return data;
  const out: Record<string, unknown> = data && typeof data === "object" && !Array.isArray(data) ? { ...(data as Record<string, unknown>) } : {};
  for (const [k, expr] of Object.entries(calc)) {
    try {
      const v = evalArith(String(expr));
      out[k] = Math.round(v * 100) / 100;
    } catch (e) {
      console.warn("[race] calc failed", k, expr, e);
    }
  }
  return out;
}

interface Step {
  calc?: Record<string, string>;
  action: "call" | "final";
  tool?: string;
  input?: Record<string, unknown>;
  answer?: string;
  data?: unknown;
}

async function agentLoop(task: Task, goal: string, opts: { budgetUsd?: number } = {}) {
  const tools = task.tools ?? [];
  const maxCalls = task.limits?.maxToolCalls ?? 8;
  const results: { tool: string; result: unknown }[] = [];
  let spent = 0;

  const system = [
    "You are Treun's procurement agent. Decide which tools to call to complete the goal, one step at a time.",
    "Reply ONLY with JSON: {\"action\":\"call\",\"tool\":\"<name>\",\"input\":{...}} or",
    "{\"action\":\"final\",\"answer\":\"<text using the tool results>\",\"data\":<object or null>,\"calc\":{\"<field>\":\"<arithmetic expression>\"}}.",
    "For ANY computed number, do not do the maths yourself: put an arithmetic expression using the exact tool numbers in calc (e.g. \"calc\":{\"totalGbp\":\"(120.5 + 80) * 0.79\"}). The app evaluates it and writes the result into data.",
    "Use exact values from tool results. Never invent data. Follow any required order of steps.",
    "When you finish, put every number or field the goal asks for in \"data\" using the exact field names the goal or schema uses (e.g. totalGbp).",
    "Do arithmetic carefully: multiply/convert using the exact tool values, sum precisely, and round money to 2 decimal places only at the end.",
    opts.budgetUsd !== undefined
      ? `Hard budget: never place an order or payment above ${opts.budgetUsd} USD in total. If the quote exceeds it, stop and give a final answer explaining the refusal.`
      : "",
    task.schema ? `The final "data" must match this JSON Schema exactly: ${JSON.stringify(task.schema)}` : "",
  ].join("\n");

  const toolList = tools.map((t) => `- ${t.name}: ${t.description}. Input schema: ${JSON.stringify(t.inputSchema)}`).join("\n");

  for (let i = 0; i <= maxCalls; i++) {
    const prompt = `Goal: ${goal}\n\nTools:\n${toolList || "(none)"}\n\nResults so far:\n${JSON.stringify(results)}\n\nCalls used: ${results.length}/${maxCalls}.`;
    const step = await askJson<Step>(prompt, system);
    if (step.action === "final" || results.length >= maxCalls) {
      const data = applyCalc(step.data, step.calc);
      console.log("[race] goal:", goal.slice(0, 300), "| calc:", JSON.stringify(step.calc), "| data:", JSON.stringify(data));
      return { answer: step.answer ?? "", data, results, spent };
    }
    const tool = tools.find((t) => t.name === step.tool);
    if (!tool) throw new TaskError("internal", `Model asked for unknown tool "${step.tool}"`);

    // Budget guard: refuse any order whose amount would break the limit, before calling the tool.
    const amount = Number((step.input as Record<string, unknown> | undefined)?.["amount"] ?? (step.input as Record<string, unknown> | undefined)?.["total"] ?? NaN);
    if (opts.budgetUsd !== undefined && /order|pay|purchase|buy/i.test(tool.name) && Number.isFinite(amount) && spent + amount > opts.budgetUsd) {
      throw new TaskError("limit_exceeded", `Refused: ${tool.name} for ${amount} would exceed the ${opts.budgetUsd} budget.`);
    }

    const result = await reliableCall(tool, task, step.input ?? {});
    results.push({ tool: tool.name, result });
    if (/order|pay|purchase|buy/i.test(tool.name) && Number.isFinite(amount)) spent += amount;
  }
  throw new TaskError("limit_exceeded", `Used all ${maxCalls} tool calls without finishing.`);
}

// ---- On-chain payment: "Pay 0.01 devnet USDC to <address> with the memo …" --------------------
const B58 = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

async function tryPayment(task: Task): Promise<TaskOutput | null> {
  const text = inputText(task);
  if (!/\bpay\b/i.test(text) || !/usdc/i.test(text) || !B58.test(text)) return null;
  const parsed = await askJson<{ to: string; amountUsdc: number; memo: string | null }>(
    `Extract the payment from this instruction. Copy the address and memo EXACTLY, character for character.\n\n${text}\n\nReply JSON: {"to": string, "amountUsdc": number, "memo": string|null}`,
  );
  const to = parsed.to?.trim();
  if (!to || !B58.test(to) || !text.includes(to)) throw new TaskError("invalid_input", "Could not read a valid recipient address.");
  if (!(parsed.amountUsdc > 0)) throw new TaskError("invalid_input", "Could not read a positive amount.");
  const cap = task.limits?.maxSpendUsd;
  if (cap !== undefined && parsed.amountUsdc > cap) {
    throw new TaskError("limit_exceeded", `Refused: ${parsed.amountUsdc} USDC exceeds the ${cap} limit.`);
  }
  const memo = parsed.memo && text.includes(parsed.memo) ? parsed.memo : undefined;
  const { signature } = await payUsdc(await loadAgentSigner(), { to, amountUsdc: parsed.amountUsdc, memo });
  return { text: `Paid ${parsed.amountUsdc} devnet USDC to ${to}.`, data: { signature } };
}

// ---- Handlers -----------------------------------------------------------------------------------
export const handlers: Record<TaskType, Handler> = {
  respond: async (task) => {
    const q = requireInput(task);
    return { text: await askLlm(q, { system: "Answer accurately and concisely. Give the direct answer first." }) };
  },

  extract: async (task) => {
    const text = requireInput(task);
    if (!task.schema || typeof task.schema !== "object") throw new TaskError("invalid_input", "Task has no JSON schema.");
    const data = await askJson(
      `Extract data from the text into JSON that matches this JSON Schema exactly (same keys, types, required fields; no extra keys).\nSchema: ${JSON.stringify(task.schema)}\n\nText:\n${text}`,
      "You convert messy text into strictly valid JSON. Output only the JSON object.",
    );
    return { data };
  },

  use_tools: async (task) => {
    const goal = requireInput(task);
    if (!task.tools?.length) throw new TaskError("invalid_input", "Task has no tools.");
    const { answer, data, results } = await agentLoop(task, goal);
    return { text: answer, data: data ?? undefined, toolResults: results };
  },

  answer_from_source: async (task) => {
    const question = requireInput(task);
    if (!task.source) throw new TaskError("invalid_input", "Task has no knowledge source.");
    let found: unknown;
    try {
      found = await searchSource(task, question);
    } catch (e) {
      if (e instanceof ToolCallError) throw new TaskError(e.httpStatus === null ? "upstream_timeout" : "upstream_unavailable", e.message);
      throw e;
    }
    const out = await askJson<{ answer: string; citations: string[]; found: boolean }>(
      `Answer the question ONLY from these documents. Cite the document ids you used. If the documents do not contain the answer, set found=false and say you don't know.\n\nQuestion: ${question}\n\nDocuments:\n${JSON.stringify(found)}\n\nReply JSON: {"answer": string, "citations": string[], "found": boolean}`,
    );
    const text = out.found ? out.answer : "I don't know: the source does not contain this information.";
    return { text, data: { answer: text, citations: out.found ? out.citations : [], found: out.found } };
  },

  converse: async (task) => {
    const msg = requireInput(task);
    if (!task.sessionId) throw new TaskError("invalid_input", "Task has no sessionId.");
    const history = await memory.history(task.sessionId);
    const turns: ChatTurn[] = [
      ...history.map((t) => ({ role: (t.role === "assistant" ? "model" : "user") as ChatTurn["role"], text: t.text })),
      { role: "user", text: msg },
    ];
    const answer = await askLlm(turns, {
      system: "You are a helpful assistant. Use facts the user told you earlier in THIS conversation. If you were never told something, say you don't know.",
    });
    await memory.append(task.sessionId, { role: "user", text: msg }, { role: "assistant", text: answer });
    return { text: answer };
  },

  run_workflow: async (task) => {
    const goal = requireInput(task);
    const paid = await tryPayment(task);
    if (paid) return paid;
    if (!task.tools?.length) throw new TaskError("invalid_input", "Task has no tools.");
    const { answer, data, results } = await agentLoop(task, goal, { budgetUsd: task.limits?.maxSpendUsd });
    return { text: answer, data: data ?? undefined, toolResults: results };
  },
};
