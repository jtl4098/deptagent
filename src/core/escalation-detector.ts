const ESCALATION_KEYWORDS = [
  "talk to a human",
  "speak to someone",
  "speak to a human",
  "escalate",
  "real person",
  "manager",
  "talk to someone",
  "human agent",
  "need a person",
  "want a human",
  "connect me to a person",
  "transfer to human",
];

export function shouldEscalate(message: string): { escalate: boolean; reason: string } {
  const lower = message.toLowerCase();
  for (const keyword of ESCALATION_KEYWORDS) {
    // Match on word boundaries rather than raw substrings, so unrelated
    // words like "management" no longer trigger the "manager" keyword.
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`);
    if (pattern.test(lower)) {
      return { escalate: true, reason: `Employee requested human help: "${keyword}"` };
    }
  }
  return { escalate: false, reason: "" };
}
