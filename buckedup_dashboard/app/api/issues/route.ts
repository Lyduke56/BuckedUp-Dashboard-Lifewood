import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";
import type { Issue, IssueSeverity } from "@/lib/types";

// Force this route to be dynamic — never statically cached by Next.js
export const dynamic = "force-dynamic";

// Local-only store. Issues are a dashboard-native resource, deliberately
// separate from the read-only Google Sheet — this file is NOT a mirror of
// anything in the Sheet and nothing here is ever written back to it.
const DATA_FILE = path.join(process.cwd(), "data", "issues.json");

async function readIssues(): Promise<Issue[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as Issue[];
  } catch {
    return [];
  }
}

async function writeIssues(issues: Issue[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(issues, null, 2));
}

export async function GET() {
  const issues = await readIssues();
  return NextResponse.json({ success: true, data: issues });
}

export async function POST(request: Request) {
  const body = await request.json();
  const rank = Number(body.rank);
  const description = String(body.description ?? "").trim();
  const severity: IssueSeverity = ["low", "medium", "high"].includes(
    body.severity,
  )
    ? body.severity
    : "medium";

  if (!Number.isFinite(rank) || !description) {
    return NextResponse.json(
      { error: "rank and description are required" },
      { status: 400 },
    );
  }

  const issue: Issue = {
    id: randomUUID(),
    rank,
    description,
    severity,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  const issues = await readIssues();
  issues.push(issue);
  await writeIssues(issues);

  return NextResponse.json({ success: true, data: issue }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const id = String(body.id ?? "");
  const status = body.status === "resolved" ? "resolved" : "open";

  const issues = await readIssues();
  const index = issues.findIndex((issue) => issue.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  issues[index] = { ...issues[index], status };
  await writeIssues(issues);

  return NextResponse.json({ success: true, data: issues[index] });
}
