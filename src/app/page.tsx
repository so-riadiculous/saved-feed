import { and, desc, eq, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { redirect } from "next/navigation";
import AddLinkForm from "@/components/AddLinkForm";
import ItemCard, { type FeedItem } from "@/components/ItemCard";
import { db } from "@/db";
import { itemInteractions, items } from "@/db/schema";
import { getCurrentPerson, type Person } from "@/lib/auth";
import { otherPerson } from "@/lib/person";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ savedBy?: string }>;
}) {
  const person = await getCurrentPerson();
  if (!person) redirect("/login");
  const other = otherPerson(person);

  const { savedBy: savedByParam } = await searchParams;
  const savedByFilter: Person | null =
    savedByParam === "ria" || savedByParam === "dad" ? savedByParam : null;

  const otherInteractions = alias(itemInteractions, "other_interactions");

  const notConsumed = or(isNull(itemInteractions.consumed), eq(itemInteractions.consumed, false));

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
    .leftJoin(
      itemInteractions,
      and(eq(itemInteractions.itemId, items.id), eq(itemInteractions.person, person)),
    )
    .leftJoin(
      otherInteractions,
      and(eq(otherInteractions.itemId, items.id), eq(otherInteractions.person, other)),
    )
    .where(savedByFilter ? and(notConsumed, eq(items.savedBy, savedByFilter)) : notConsumed)
    .orderBy(desc(items.lastSavedAt));

  const feedItems: FeedItem[] = rows.map((row) => ({
    ...row,
    tags: row.tags ?? [],
    reaction: row.reaction ?? null,
    comment: row.comment ?? null,
    consumed: row.consumed ?? false,
    otherComment: row.otherComment ?? null,
  }));

  const filters: { label: string; value: Person | null }[] = [
    { label: "All", value: null },
    { label: "Ria", value: "ria" },
    { label: "Dad", value: "dad" },
  ];

  return (
    <div className="mx-auto max-w-xl px-4">
      <AddLinkForm />

      <div className="flex items-center gap-2 border-b border-white/10 py-4">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/?savedBy=${f.value}` : "/"}
            className={`rounded-full px-3 py-1 text-sm ${
              savedByFilter === f.value
                ? "bg-white/20 text-white"
                : "text-white/50 hover:bg-white/10"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {feedItems.length === 0 ? (
        <p className="py-12 text-center text-white/40">Nothing saved yet.</p>
      ) : (
        feedItems.map((item) => <ItemCard key={item.id} item={item} otherPerson={other} />)
      )}
    </div>
  );
}
