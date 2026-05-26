import fs from "fs";
import path from "path";
import { getKnowledgeFilesForAgent } from "@/db";

const KNOWLEDGE_DIR = path.join(process.cwd(), "src/knowledge");

const agentCache = new Map<string, string>();
let allCache: string | null = null;

function readFiles(filenames: string[]): string {
  const parts = filenames
    .filter((f) => fs.existsSync(path.join(KNOWLEDGE_DIR, f)))
    .map((file) => {
      const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8");
      return `--- ${file} ---\n${content}`;
    });
  return parts.join("\n\n");
}

export function loadKnowledgeForAgent(agentId: string): string {
  const cached = agentCache.get(agentId);
  if (cached !== undefined) {
    return cached;
  }

  const filenames = getKnowledgeFilesForAgent(agentId);

  if (filenames.length === 0) {
    // Fallback: load all files if no agent-specific mapping exists
    const result = loadKnowledge();
    agentCache.set(agentId, result);
    return result;
  }

  const result = readFiles(filenames);
  agentCache.set(agentId, result);
  return result;
}

export function loadKnowledge(): string {
  if (allCache !== null) {
    return allCache;
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
  allCache = readFiles(files);
  return allCache;
}

export function clearKnowledgeCache(): void {
  agentCache.clear();
  allCache = null;
}
