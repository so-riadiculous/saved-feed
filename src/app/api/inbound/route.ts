import { NextRequest, NextResponse } from "next/server";
import type { Person } from "@/lib/auth";
import { saveItem } from "@/lib/save-item";

function personForSender(fromAddress: string): Person | null {
  const email = (fromAddress.match(/<(.+)>/)?.[1] ?? fromAddress).trim().toLowerCase();
  const riaEmails = (process.env.RIA_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const dadEmails = (process.env.DAD_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (riaEmails.includes(email)) return "ria";
  if (dadEmails.includes(email)) return "dad";
  return null;
}

// Splits on each "http(s)://" boundary rather than requiring whitespace between
// URLs, since consecutive links with no separator (e.g. line breaks stripped by
// an email client) would otherwise all get swallowed into one giant match.
function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/(?:(?!https?:\/\/)\S)+/g) ?? [];
  return matches.map((m) => m.replace(/[).,;!?\]]+$/, "").trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-inbound-secret");
  if (!secret || secret !== process.env.INBOUND_SHARED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { from?: unknown; subject?: unknown; text?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { from, subject, text } = payload;
  if (typeof from !== "string" || from.trim().length === 0) {
    return NextResponse.json({ error: "Missing sender" }, { status: 400 });
  }

  const person = personForSender(from);
  if (!person) {
    return NextResponse.json({ error: "Sender not recognized" }, { status: 403 });
  }

  const body =
    typeof text === "string" && text.trim().length > 0
      ? text
      : typeof subject === "string"
        ? subject
        : "";
  if (body.trim().length === 0) {
    return NextResponse.json({ error: "Empty email" }, { status: 400 });
  }

  const urls = extractUrls(body);

  if (urls.length > 1) {
    // Multiple links in one email (e.g. a batch send) — save each on its own,
    // bare, since there's no reliable way to know which leftover text (if any)
    // belongs to which link.
    const itemIds = [];
    for (const url of urls) {
      const { itemId } = await saveItem({ input: url, comment: null, person });
      itemIds.push(itemId);
    }
    return NextResponse.json({ itemIds }, { status: 201 });
  }

  if (urls.length === 1) {
    const note = body.replace(urls[0], " ").replace(/\s+/g, " ").trim();
    const { itemId } = await saveItem({ input: urls[0], comment: note || null, person });
    return NextResponse.json({ itemId }, { status: 201 });
  }

  const { itemId } = await saveItem({ input: body, comment: null, person });
  return NextResponse.json({ itemId }, { status: 201 });
}
