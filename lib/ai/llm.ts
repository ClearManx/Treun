import "server-only";

// Minimal Gemini client over REST (no SDK). Set GEMINI_API_KEY in .env.local
// (free key: https://aistudio.google.com/apikey). GEMINI_MODEL is optional.
// If a model is unavailable (404) or has no free quota (429/403), it falls through to the next one.

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export class LlmError extends Error {}

const BASE = "https://generativelanguage.googleapis.com/v1beta";
let candidates: Promise<string[]> | null = null;
let working: string | null = null;
const dead = new Set<string>();

function rank(n: string): number {
  // Prefer plain flash, then flash-lite, then anything else.
  if (/flash/i.test(n) && !/lite/i.test(n)) return 0;
  if (/flash-lite|flash.*lite/i.test(n)) return 1;
  return 2;
}

async function listCandidates(key: string): Promise<string[]> {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  candidates ??= (async () => {
    const res = await fetch(`${BASE}/models?key=${key}&pageSize=200`, { signal: AbortSignal.timeout(10_000) });
    const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const names = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((n) => /gemini|gemma/i.test(n) && !/(image|tts|audio|live|embedding|vision|native|computer)/i.test(n));
    names.sort((a, b) => rank(a) - rank(b) || b.localeCompare(a, undefined, { numeric: true }));
    if (!names.length) throw new LlmError("No usable Gemini model found for this key; set GEMINI_MODEL in .env.local");
    return names;
  })().catch((e) => {
    candidates = null;
    throw e;
  });
  return candidates;
}

async function generate(model: string, key: string, body: unknown, timeoutMs: number) {
  const res = await fetch(`${BASE}/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    error?: { message?: string };
  };
  return { status: res.status, ok: res.ok, data };
}

// ---- OpenAI (used when OPENAI_API_KEY is set) ------------------------------------------------
let openaiModel: Promise<string> | null = null;
async function pickOpenAiModel(key: string): Promise<string> {
  if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL;
  openaiModel ??= (async () => {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { data?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) throw new LlmError(`OpenAI HTTP ${res.status}: ${data.error?.message ?? "error"}`);
    const ids = (data.data ?? []).map((m) => m.id).filter((id) => /^gpt-/.test(id) && !/(audio|realtime|search|transcribe|tts|image|codex|instruct|\d{4}-\d{2}-\d{2})/.test(id));
    const minis = ids.filter((id) => /mini/.test(id) && !/nano/.test(id));
    const pool = minis.length ? minis : ids;
    pool.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (!pool[0]) throw new LlmError("No usable OpenAI model found; set OPENAI_MODEL in .env.local");
    console.log(`[llm] using OpenAI model ${pool[0]}`);
    return pool[0];
  })().catch((e) => {
    openaiModel = null;
    throw e;
  });
  return openaiModel;
}

async function askOpenAi(key: string, turns: ChatTurn[], opts: { system?: string; json?: boolean; timeoutMs?: number }): Promise<string> {
  const model = await pickOpenAiModel(key);
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    ...turns.map((t) => ({ role: t.role === "model" ? "assistant" : "user", content: t.text })),
  ];
  if (opts.json && !/json/i.test(JSON.stringify(messages))) messages.push({ role: "system", content: "Reply in JSON." });
  const deadline = Date.now() + (opts.timeoutMs ?? 16_000);
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages,
          max_completion_tokens: Number(process.env.OPENAI_MAX_TOKENS || 2000), // caps cost per call
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(left),
      });
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
      if (res.ok) {
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
        last = "empty answer";
        continue;
      }
      last = `HTTP ${res.status}: ${data.error?.message ?? ""}`.slice(0, 200);
      console.warn(`[llm] OpenAI ${last}`);
      if (res.status < 500 && res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    } catch (e) {
      last = e instanceof Error ? e.message : "network error";
    }
  }
  throw new LlmError(`OpenAI call failed (${last})`);
}

export async function askLlm(
  prompt: string | ChatTurn[],
  opts: { system?: string; json?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const turnsO: ChatTurn[] = typeof prompt === "string" ? [{ role: "user", text: prompt }] : prompt;
    return askOpenAi(openaiKey, turnsO, opts);
  }
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new LlmError("Set OPENAI_API_KEY or GEMINI_API_KEY in .env.local");
  const turns: ChatTurn[] = typeof prompt === "string" ? [{ role: "user", text: prompt }] : prompt;
  const body: Record<string, unknown> = {
    contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: { temperature: 0, ...(opts.json ? { responseMimeType: "application/json" } : {}) },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  const all = await listCandidates(key);
  const order = [...(working ? [working] : []), ...all.filter((m) => m !== working && !dead.has(m))];
  let lastErr = "no model tried";

  const deadline = Date.now() + (opts.timeoutMs ?? 16_000);
  for (const model of order.slice(0, 4)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 1500) throw new LlmError(`Gemini call failed (out of time; last: ${lastErr})`);
      let r: Awaited<ReturnType<typeof generate>>;
      try {
        r = await generate(model, key, body, left);
      } catch (e) {
        lastErr = `${model}: ${e instanceof Error ? e.message : "network error"}`;
        continue; // transient: retry once
      }
      if (r.ok) {
        const text = (r.data.candidates?.[0]?.content?.parts ?? [])
          .filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        if (!text) {
          lastErr = `${model}: empty answer`;
          continue;
        }
        if (working !== model) console.log(`[llm] using Gemini model ${model}`);
        working = model;
        return text;
      }
      lastErr = `${model}: HTTP ${r.status} ${r.data.error?.message ?? ""}`.slice(0, 200);
      console.warn(`[llm] ${lastErr}`);
      if (r.status === 404 || r.status === 403 || r.status === 400) {
        dead.add(model);
        break; // try next model
      }
      if (r.status === 429) {
        // Per-minute limits recover; zero-quota models don't. Move on to the next model.
        if (working === model) working = null;
        break;
      }
      // 5xx: brief pause, retry same model once
      await new Promise((res) => setTimeout(res, 400));
    }
  }
  throw new LlmError(`Gemini call failed (${lastErr})`);
}

/** Ask for JSON and parse it (strips ``` fences if the model adds them). */
export async function askJson<T = unknown>(prompt: string | ChatTurn[], system?: string): Promise<T> {
  const raw = await askLlm(prompt, { system, json: true });
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.search(/[\[{]/);
  return JSON.parse(start > 0 ? cleaned.slice(start) : cleaned) as T;
}
