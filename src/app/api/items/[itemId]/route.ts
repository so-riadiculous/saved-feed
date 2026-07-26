import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { items } from "@/db/schema";
import { getCurrentPerson } from "@/lib/auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const person = await getCurrentPerson();
  if (!person) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId: itemIdParam } = await params;
  const itemId = Number(itemIdParam);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  // No ownership check by design: items are shared between both people (one
  // row, both perspectives via item_interactions), so either person deleting
  // it is meant to remove it for both — matches the confirm-dialog copy in
  // ItemCard ("Delete this item for both of you?"). Not an oversight.
  await db.delete(items).where(eq(items.id, itemId));
  return NextResponse.json({ ok: true });
}
