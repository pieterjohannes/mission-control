import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const WORKSPACE = "/Users/pieter/clawd";

function isSafePath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const workspaceResolved = path.resolve(WORKSPACE);
  return resolved.startsWith(workspaceResolved + path.sep) || resolved === workspaceResolved;
}

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  if (!isSafePath(filePath)) {
    return NextResponse.json({ error: "Access denied: path outside workspace" }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ content, path: filePath });
  } catch (err) {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
