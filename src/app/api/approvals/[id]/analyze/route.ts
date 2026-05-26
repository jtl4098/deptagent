import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { getApprovalById } from "@/db";
import { loadKnowledgeForAgent } from "@/core/knowledge-loader";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

type PolicyAnalysis = {
  recommendation: "approve" | "reject" | "needs_review";
  confidence: "high" | "medium" | "low";
  reasoning: string;
  references: string[];
  flags: string[];
  summary: string;
};

const SYSTEM_PROMPT = `You are an HR Policy Analyst. Your role is to analyze employee benefit/PD budget requests against company policies and provide a structured recommendation.

You will receive:
1. The full company policy documentation
2. An employee's approval request with details

Analyze the request against the policies and respond with ONLY a JSON object (no markdown, no code fences) in this exact format:
{
  "recommendation": "approve" | "reject" | "needs_review",
  "confidence": "high" | "medium" | "low",
  "reasoning": "detailed explanation citing specific policy sections",
  "references": ["policy-file.md - Section Name"],
  "flags": ["any warnings or special conditions"],
  "summary": "one-line summary of the analysis"
}

Guidelines:
- Base your analysis strictly on the provided policy documents
- Cite specific policy sections in your reasoning
- Flag any conditions that require special attention (e.g., VP approval thresholds, eligibility concerns)
- If the request type or details are ambiguous, recommend "needs_review"
- Be objective and thorough`;

function extractJson(text: string): PolicyAnalysis | null {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // noop
  }

  // Try extracting from code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // noop
    }
  }

  // Try finding first { ... } block
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      // noop
    }
  }

  return null;
}

const FALLBACK_ANALYSIS: PolicyAnalysis = {
  recommendation: "needs_review",
  confidence: "low",
  reasoning: "Unable to complete automated analysis. Please review manually.",
  references: [],
  flags: ["Automated analysis failed -- manual review required"],
  summary: "Analysis could not be completed",
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const approval = getApprovalById(id);
    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    let details: Record<string, unknown> = {};
    try {
      details = JSON.parse(approval.details);
    } catch {
      // noop
    }

    const knowledge = loadKnowledgeForAgent("benefits_agent");

    const userMessage = `Please analyze this approval request:

Employee: ${approval.employee_name}
Request Type: ${approval.request_type}
Item: ${details.itemName ?? "N/A"}
Description: ${details.description ?? "N/A"}
Cost (USD): ${details.costUsd ?? "N/A"}
Submitted: ${new Date(approval.created_at * 1000).toISOString()}
Status: ${approval.status}`;

    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      system: `${SYSTEM_PROMPT}\n\n## Company Policy Documents\n\n${knowledge}`,
      messages: [{ role: "user", content: userMessage }],
    });

    const analysis = extractJson(text) ?? FALLBACK_ANALYSIS;

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[approvals/analyze] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
