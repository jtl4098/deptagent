/**
 * agent-context validation experiment.
 *
 * For one capability (agent-orchestration), runs a fixed set of evaluation
 * questions under three context conditions, captures input/output token
 * counts from the Anthropic API, and grades each response with an LLM
 * judge against a hand-written answer key.
 *
 * Run from repo root:
 *   pnpm tsx scripts/agent-context-eval/run.ts
 *
 * Reads ANTHROPIC_API_KEY from .env.local.
 *
 * Output:
 *   scripts/agent-context-eval/results-<timestamp>.json (raw)
 *   stdout summary table
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not set (looked in .env.local). Exiting.");
  process.exit(1);
}

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";
const MAIN_MAX_TOKENS = 600;
const JUDGE_MAX_TOKENS = 200;

const QUESTIONS_PATH = "scripts/agent-context-eval/questions.json";
const AGENT_CONTEXT_PATH = "docs/capabilities/agent-orchestration/agent-context.md";
const RAW_CODE_FILES = [
  "src/core/orchestrator.ts",
  "src/core/agent-runner.ts",
  "src/core/escalation-detector.ts",
  "src/app/api/chat/route.ts",
  "src/agents/index.ts",
  "src/agents/types.ts",
];

const SYSTEM_PROMPT = `You are a senior engineer answering a colleague's technical question about the DeptAgent codebase.

Answer based ONLY on the context provided in the user message. If the information needed to answer is not present in the provided context, say so explicitly — do not guess, do not infer from your training, do not fabricate file paths, function names, or behavior.

Keep answers concise: 3-5 sentences in most cases.`;

const JUDGE_SYSTEM_PROMPT = `You are an impartial evaluator. You will receive: a question, a ground-truth answer key, an indicator of whether the question is a CONTROL question, and a candidate response.

Score the candidate response on a 0-2 integer scale.

Non-control questions:
  2 = correct and complete; covers the key facts in the answer key.
  1 = partially correct; right direction but missing or slightly wrong details.
  0 = incorrect, hallucinated, or says "I do not know" when the answer was in the context.

Control questions (the correct response is to refuse to answer because the info is NOT in the provided context):
  2 = response explicitly says the information is not in the provided context (and does not fabricate an answer).
  1 = response expresses uncertainty but partially attempts an answer.
  0 = response confidently fabricates an answer from training data or imagination.

Respond with ONLY a single JSON object, no markdown fences:
{"score": 0|1|2, "reasoning": "<one short sentence>"}`;

type AskResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

async function ask(context: string, question: string): Promise<AskResult> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: MAIN_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `## Context\n\n${context}\n\n## Question\n\n${question}`,
      },
    ],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return {
    text,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  };
}

type JudgeResult = {
  score: number;
  reasoning: string;
  inputTokens: number;
  outputTokens: number;
  parsedOk: boolean;
};

async function judge(
  question: string,
  answerKey: string,
  isControl: boolean,
  candidateResponse: string
): Promise<JudgeResult> {
  const controlTag = isControl
    ? "[CONTROL QUESTION: the correct response is to say the info is not in the context.]\n\n"
    : "";
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: JUDGE_MAX_TOKENS,
    system: JUDGE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${controlTag}Question:\n${question}\n\nAnswer key:\n${answerKey}\n\nCandidate response:\n${candidateResponse}`,
      },
    ],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  try {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fence ? fence[1].trim() : text;
    const parsed = JSON.parse(jsonStr);
    return {
      score: Number(parsed.score),
      reasoning: String(parsed.reasoning),
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      parsedOk: true,
    };
  } catch (err) {
    return {
      score: -1,
      reasoning: `parse failed: ${text.slice(0, 120)}`,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      parsedOk: false,
    };
  }
}

type QuestionEntry = {
  id: string;
  category: string;
  question: string;
  answer_key: string;
};

async function main() {
  // Load questions
  const data = JSON.parse(fs.readFileSync(QUESTIONS_PATH, "utf-8")) as {
    capability: string;
    model: string;
    questions: QuestionEntry[];
  };

  // Load contexts
  const agentContextContent = fs.readFileSync(AGENT_CONTEXT_PATH, "utf-8");
  const rawCodeContent = RAW_CODE_FILES.map(
    (f) => `--- ${f} ---\n${fs.readFileSync(f, "utf-8")}`
  ).join("\n\n");

  const conditions: Record<string, string> = {
    A_agent_context_only: agentContextContent,
    B_raw_code_only: rawCodeContent,
    C_combined: `## agent-context.md\n\n${agentContextContent}\n\n## Source code\n\n${rawCodeContent}`,
  };

  const results: Record<string, unknown> = {
    capability: data.capability,
    model: MODEL,
    timestamp: new Date().toISOString(),
    raw_code_files: RAW_CODE_FILES,
    agent_context_file: AGENT_CONTEXT_PATH,
    context_chars: Object.fromEntries(
      Object.entries(conditions).map(([k, v]) => [k, v.length])
    ),
    per_question: [] as Array<Record<string, unknown>>,
  };

  for (const q of data.questions) {
    const isControl = q.category === "control";
    console.log(`[${q.id}] (${q.category}) ${q.question.slice(0, 70)}...`);
    const entry: Record<string, unknown> = {
      id: q.id,
      category: q.category,
      question: q.question,
      answer_key: q.answer_key,
      is_control: isControl,
      conditions: {} as Record<string, unknown>,
    };
    for (const [cname, ctx] of Object.entries(conditions)) {
      process.stdout.write(`  -> ${cname} ... `);
      const ans = await ask(ctx, q.question);
      const ev = await judge(q.question, q.answer_key, isControl, ans.text);
      (entry.conditions as Record<string, unknown>)[cname] = {
        response: ans.text,
        input_tokens: ans.inputTokens,
        output_tokens: ans.outputTokens,
        judge_score: ev.score,
        judge_reasoning: ev.reasoning,
        judge_parsed_ok: ev.parsedOk,
        judge_input_tokens: ev.inputTokens,
        judge_output_tokens: ev.outputTokens,
      };
      console.log(`in=${ans.inputTokens} out=${ans.outputTokens} score=${ev.score}`);
    }
    (results.per_question as Array<Record<string, unknown>>).push(entry);
  }

  // Summary
  const summary: Record<string, unknown> = {};
  const conditionNames = Object.keys(conditions);
  for (const cname of conditionNames) {
    let sumIn = 0;
    let sumOut = 0;
    let totalScore = 0;
    let scored = 0;
    const perCategoryScore: Record<string, { sum: number; n: number }> = {};
    for (const entry of results.per_question as Array<Record<string, unknown>>) {
      const c = (entry.conditions as Record<string, unknown>)[cname] as {
        input_tokens: number;
        output_tokens: number;
        judge_score: number;
      };
      sumIn += c.input_tokens;
      sumOut += c.output_tokens;
      if (c.judge_score >= 0) {
        totalScore += c.judge_score;
        scored += 1;
      }
      const cat = entry.category as string;
      if (!perCategoryScore[cat]) perCategoryScore[cat] = { sum: 0, n: 0 };
      if (c.judge_score >= 0) {
        perCategoryScore[cat].sum += c.judge_score;
        perCategoryScore[cat].n += 1;
      }
    }
    const n = (results.per_question as Array<unknown>).length;
    summary[cname] = {
      avg_input_tokens: Math.round(sumIn / n),
      avg_output_tokens: Math.round(sumOut / n),
      total_input_tokens: sumIn,
      total_output_tokens: sumOut,
      accuracy_total: totalScore,
      accuracy_max: scored * 2,
      accuracy_pct: scored > 0 ? Math.round((totalScore / (scored * 2)) * 100) : 0,
      per_category: Object.fromEntries(
        Object.entries(perCategoryScore).map(([cat, v]) => [
          cat,
          { sum: v.sum, max: v.n * 2 },
        ])
      ),
    };
  }
  results.summary = summary;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = `scripts/agent-context-eval/results-${stamp}.json`;
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nFull results: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
