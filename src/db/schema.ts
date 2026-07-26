import { pgTable, serial, integer, text, boolean, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";

export const personEnum = pgEnum("person", ["ria", "dad"]);
export const reactionEnum = pgEnum("reaction", ["like", "dislike", "neutral"]);

// Shared content metadata. One row per unique saved URL (deduped), or one row per
// pasted text excerpt (no URL, never deduped — url/content are mutually exclusive).
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  url: text("url").unique(),
  content: text("content"),
  title: text("title"),
  image: text("image"),
  siteName: text("site_name"),
  author: text("author"),
  savedBy: personEnum("saved_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSavedAt: timestamp("last_saved_at", { withTimezone: true }).notNull().defaultNow(),
});

// Each person's own tags/reaction/comment/consumed-status on a given item.
// Independent per person: Ria and Dad can each have their own take on the same item.
export const itemInteractions = pgTable(
  "item_interactions",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    person: personEnum("person").notNull(),
    tags: text("tags").array().notNull().default([]),
    reaction: reactionEnum("reaction"),
    comment: text("comment"),
    consumed: boolean("consumed").notNull().default(false),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.itemId, table.person)],
);
