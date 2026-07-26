"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddLinkForm() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, comment: comment.trim() || undefined }),
    });

    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't save that");
      return;
    }
    setInput("");
    setComment("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-b border-white/10 py-6">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste a link, or a bit of text to save as a note…"
        required
        rows={2}
        className="w-full resize-none rounded-md bg-white/5 px-3 py-2 text-sm outline-none placeholder-white/30"
      />
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Note (optional)"
        className="w-full rounded-md bg-white/5 px-3 py-2 text-sm outline-none placeholder-white/30"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
