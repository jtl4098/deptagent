import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { clearKnowledgeCache } from "@/core/knowledge-loader";

const KNOWLEDGE_DIR = path.join(process.cwd(), "src/knowledge");

function isValidFilename(name: string): boolean {
  return /^[a-zA-Z0-9_-]+\.md$/.test(name) && !name.includes("..") && !name.includes("/") && !name.includes("\\");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!isValidFilename(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(KNOWLEDGE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return NextResponse.json({ filename, content });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!isValidFilename(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  try {
    const { content } = await req.json();
    const filePath = path.join(KNOWLEDGE_DIR, filename);
    fs.writeFileSync(filePath, content ?? "", "utf-8");
    clearKnowledgeCache();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[knowledge] PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!isValidFilename(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(KNOWLEDGE_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    clearKnowledgeCache();
  }

  return NextResponse.json({ success: true });
}
