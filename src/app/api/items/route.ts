import { NextRequest, NextResponse } from "next/server";
import { getCurrentPerson } from "@/lib/auth";
import { saveItem } from "@/lib/save-item";

export async function POST(request: NextRequest) {
  const person = await getCurrentPerson();
  if (!person) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { input?: unknown; comment?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { input, comment } = body;
  if (typeof input !== "string" || input.trim().length === 0) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const { itemId } = await saveItem({
    input,
    comment: typeof comment === "string" ? comment : undefined,
    person,
  });
  return NextResponse.json({ itemId }, { status: 201 });
}
