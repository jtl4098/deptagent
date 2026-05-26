import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { clearKnowledgeCache } from "@/core/knowledge-loader";

const KNOWLEDGE_DIR = path.join(process.cwd(), "src/knowledge");

function isValidFilename(name: string): boolean {
  return /^[a-zA-Z0-9_-]+\.md$/.test(name) && !name.includes("..") && !name.includes("/") && !name.includes("\\");
}

export async function GET() {
  try {
    const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
    const fileList = files.map((filename) => {
      const filePath = path.join(KNOWLEDGE_DIR, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        size: stats.size,
        modifiedAt: Math.floor(stats.mtimeMs / 1000),
      };
    });
    return NextResponse.json({ files: fileList });
  } catch (err) {
    console.error("[knowledge] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { filename, content } = await req.json();

    if (!filename || !isValidFilename(filename)) {
      return NextResponse.json(
        { error: "Invalid filename. Use alphanumeric, hyphens, underscores only, ending with .md" },
        { status: 400 }
      );
    }

    const filePath = path.join(KNOWLEDGE_DIR, filename);
    if (fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File already exists" }, { status: 409 });
    }

    fs.writeFileSync(filePath, content || "", "utf-8");
    clearKnowledgeCache();

    return NextResponse.json({ filename });
  } catch (err) {
    console.error("[knowledge] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
