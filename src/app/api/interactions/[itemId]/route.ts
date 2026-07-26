import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { itemInteractions } from "@/db/schema";
import { getCurrentPerson } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const person = await getCurrentPerson();
  if (!person) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId: itemIdParam } = await params;
  const itemId = Number(itemIdParam);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Partial<typeof itemInteractions.$inferInsert> = { updatedAt: new Date() };

  if (Array.isArray(body.tags)) {
    update.tags = body.tags.filter((t: unknown): t is string => typeof t === "string");
  }
  if (["like", "dislike", "neutral", null].includes(body.reaction as string | null)) {
    update.reaction = body.reaction as "like" | "dislike" | "neutral" | null;
  }
  if (typeof body.comment === "string" || body.comment === null) {
    update.comment = body.comment;
  }
  if (typeof body.consumed === "boolean") {
    update.consumed = body.consumed;
    update.consumedAt = body.consumed ? new Date() : null;
  }

  // Atomic upsert (rather than select-then-branch) so two concurrent PATCHes
  // for a brand-new (itemId, person) row can't both take the "insert" path and
  // hit the unique(itemId, person) constraint as an uncaught crash.
  await db
    .insert(itemInteractions)
    .values({ itemId, person, ...update })
    .onConflictDoUpdate({
      target: [itemInteractions.itemId, itemInteractions.person],
      set: update,
    });

  return NextResponse.json({ ok: true });
}
