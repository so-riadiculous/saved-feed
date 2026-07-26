import { eq } from "drizzle-orm";
import { db } from "@/db";
import { itemInteractions, items } from "@/db/schema";
import type { Person } from "@/lib/auth";
import { fetchOgMetadata, type OgMetadata } from "@/lib/og";

export function parseHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function saveItem({
  input,
  comment,
  person,
}: {
  input: string;
  comment?: string | null;
  person: Person;
}): Promise<{ itemId: number }> {
  const trimmedInput = input.trim();
  const normalizedUrl = parseHttpUrl(trimmedInput);

  let itemId: number;

  if (normalizedUrl) {
    const [existing] = await db.select().from(items).where(eq(items.url, normalizedUrl)).limit(1);

    if (existing) {
      itemId = existing.id;
      await db.update(items).set({ lastSavedAt: new Date() }).where(eq(items.id, itemId));
    } else {
      let meta: OgMetadata = { title: null, image: null, siteName: null, author: null };
      try {
        meta = await fetchOgMetadata(normalizedUrl);
      } catch {
        // Fall back to a URL-only item if the page can't be fetched/parsed.
      }

      const [inserted] = await db
        .insert(items)
        .values({
          url: normalizedUrl,
          title: meta.title,
          image: meta.image,
          siteName: meta.siteName,
          author: meta.author,
          savedBy: person,
        })
        .onConflictDoUpdate({ target: items.url, set: { lastSavedAt: new Date() } })
        .returning();
      itemId = inserted.id;
    }
  } else {
    // Plain text excerpt, not a URL. Never deduped — always a new item.
    const [inserted] = await db
      .insert(items)
      .values({ content: trimmedInput, savedBy: person })
      .returning();
    itemId = inserted.id;
  }

  // Atomic "insert if not exists" (rather than select-then-insert) so two
  // concurrent saves of the same item by the same person can't both see no
  // existing row and both try to insert, hitting the unique constraint as an
  // uncaught crash. onConflictDoNothing (not DoUpdate) since an existing
  // interaction's data should never be clobbered by a re-save.
  await db
    .insert(itemInteractions)
    .values({
      itemId,
      person,
      comment: comment && comment.trim().length > 0 ? comment.trim() : null,
    })
    .onConflictDoNothing({ target: [itemInteractions.itemId, itemInteractions.person] });

  return { itemId };
}
