"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type FeedItem = {
  id: number;
  url: string | null;
  content: string | null;
  title: string | null;
  image: string | null;
  siteName: string | null;
  author: string | null;
  savedBy: "ria" | "dad";
  tags: string[];
  reaction: "like" | "dislike" | "neutral" | null;
  comment: string | null;
  otherComment: string | null;
  consumed: boolean;
};

async function patchInteraction(itemId: number, body: Record<string, unknown>) {
  await fetch(`/api/interactions/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const REACTIONS: { value: "like" | "dislike" | "neutral"; label: string }[] = [
  { value: "like", label: "👍" },
  { value: "neutral", label: "😐" },
  { value: "dislike", label: "👎" },
];

export default function ItemCard({
  item,
  otherPerson,
}: {
  item: FeedItem;
  otherPerson: "ria" | "dad";
}) {
  const router = useRouter();
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(item.tags);
  const [comment, setComment] = useState(item.comment ?? "");
  const [editingComment, setEditingComment] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const [reaction, setReaction] = useState(item.reaction);
  const [imageFailed, setImageFailed] = useState(false);
  const [consumed, setConsumed] = useState(item.consumed);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editingComment && commentRef.current) {
      const el = commentRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editingComment]);

  async function toggleReaction(value: "like" | "dislike" | "neutral") {
    const next = reaction === value ? null : value;
    setReaction(next);
    await patchInteraction(item.id, { reaction: next });
  }

  async function addTag() {
    const trimmed = tagInput.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setTagInput("");
      return;
    }
    const next = [...tags, trimmed];
    setTags(next);
    setTagInput("");
    await patchInteraction(item.id, { tags: next });
  }

  async function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    await patchInteraction(item.id, { tags: next });
  }

  async function saveComment() {
    setEditingComment(false);
    await patchInteraction(item.id, { comment: comment.trim() || null });
  }

  async function toggleConsumed() {
    setBusy(true);
    const next = !consumed;
    setConsumed(next);
    await patchInteraction(item.id, { consumed: next });
    router.refresh();
  }

  async function deleteItem() {
    if (!confirm("Delete this item for both of you? This can't be undone.")) return;
    setBusy(true);
    await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    router.refresh();
  }

  const badge = (
    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs capitalize text-white/50">
      {item.savedBy}
    </span>
  );

  return (
    <article className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      {item.url && item.image && !imageFailed && (
        <a href={item.url} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image}
            alt=""
            className="max-h-80 w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        </a>
      )}

      <div className="p-4">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="group block">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium group-hover:underline">{item.title || item.url}</span>
              {badge}
            </div>
            {(item.siteName || item.author) && (
              <p className="mt-1 text-sm text-white/40">
                {[item.siteName, item.author].filter(Boolean).join(" · ")}
              </p>
            )}
          </a>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <p className="whitespace-pre-wrap italic text-white/90">“{item.content}”</p>
            {badge}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          {REACTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => toggleReaction(r.value)}
              className={`rounded-full px-2 py-1 text-lg ${
                reaction === r.value ? "bg-white/20" : "opacity-40 hover:opacity-80"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="text-white/40 hover:text-white">
                ×
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="add tag…"
            className="w-24 bg-transparent text-xs text-white/60 outline-none placeholder-white/30"
          />
        </div>

        {item.otherComment && (
          <p className="mt-3 whitespace-pre-wrap rounded-md bg-white/5 p-2 text-sm text-white/50">
            <span className="mr-1 font-medium capitalize text-white/70">{otherPerson}:</span>
            {item.otherComment}
          </p>
        )}

        {editingComment ? (
          <textarea
            ref={commentRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={saveComment}
            placeholder="Notes…"
            rows={2}
            className="mt-3 w-full resize-none rounded-md bg-white/5 p-2 text-sm outline-none placeholder-white/30"
          />
        ) : (
          <button
            onClick={() => setEditingComment(true)}
            className={`mt-3 block w-full whitespace-pre-wrap rounded-md p-2 text-left text-sm hover:bg-white/5 ${
              comment ? "text-white/80" : "text-white/30"
            }`}
          >
            {comment || "Add a note…"}
          </button>
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3">
          <button
            onClick={toggleConsumed}
            disabled={busy}
            className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-50"
          >
            {consumed ? "Move back to feed" : "Mark consumed"}
          </button>
          <button
            onClick={deleteItem}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm text-red-400/70 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
