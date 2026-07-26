import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { redirect } from "next/navigation";
import ItemCard, { type FeedItem } from "@/components/ItemCard";
import { db } from "@/db";
import { itemInteractions, items } from "@/db/schema";
import { getCurrentPerson } from "@/lib/auth";
import { otherPerson } from "@/lib/person";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const person = await getCurrentPerson();
  if (!person) redirect("/login");
  const other = otherPerson(person);

  const { q } = await searchParams;

  const otherInteractions = alias(itemInteractions, "other_interactions");

  const rows = await db
    .select({
      id: items.id,
      url: items.url,
      content: items.content,
      title: items.title,
      image: items.image,
      siteName: items.siteName,
      author: items.author,
      savedBy: items.savedBy,
      tags: itemInteractions.tags,
      reaction: itemInteractions.reaction,
      comment: itemInteractions.comment,
      consumed: itemInteractions.consumed,
      otherComment: otherInteractions.comment,
    })
    .from(items)
    .innerJoin(
      itemInteractions,
      and(eq(itemInteractions.itemId, items.id), eq(itemInteractions.person, person)),
    )
    .leftJoin(
      otherInteractions,
      and(eq(otherInteractions.itemId, items.id), eq(otherInteractions.person, other)),
    )
    .where(eq(itemInteractions.consumed, true))
    .orderBy(desc(itemInteractions.consumedAt));

  const archiveItems: FeedItem[] = rows.map((row) => ({
    ...row,
    tags: row.tags ?? [],
    otherComment: row.otherComment ?? null,
  }));

  const query = q?.trim().toLowerCase();
  const filtered = query
    ? archiveItems.filter((item) =>
        [item.title, item.content, item.comment, item.otherComment, ...item.tags]
          .filter((v): v is string => Boolean(v))
          .some((v) => v.toLowerCase().includes(query)),
      )
    : archiveItems;

  return (
    <div className="mx-auto max-w-xl px-4">
      <form className="border-b border-white/10 py-6">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search your archive…"
          className="w-full rounded-md bg-white/5 px-3 py-2 text-sm outline-none placeholder-white/30"
        />
      </form>
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-white/40">
          {query ? "No matches." : "Nothing consumed yet."}
        </p>
      ) : (
        filtered.map((item) => <ItemCard key={item.id} item={item} otherPerson={other} />)
      )}
    </div>
  );
}
