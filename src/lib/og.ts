import * as cheerio from "cheerio";

export type OgMetadata = {
  title: string | null;
  image: string | null;
  siteName: string | null;
  author: string | null;
};

function meta($: cheerio.CheerioAPI, ...names: string[]): string | null {
  for (const name of names) {
    const value =
      $(`meta[property="${name}"]`).attr("content") ?? $(`meta[name="${name}"]`).attr("content");
    if (value) return value;
  }
  return null;
}

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

// YouTube serves a degraded page (missing OG tags) to requests from datacenter IPs
// like Vercel's, even with a browser User-Agent. Their oEmbed API is meant for
// exactly this (title/thumbnail/author for embedding) and isn't subject to that.
async function fetchYouTubeOembed(url: string): Promise<OgMetadata | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title ?? null,
      image: data.thumbnail_url ?? null,
      siteName: data.provider_name ?? "YouTube",
      author: data.author_name ?? null,
    };
  } catch {
    return null;
  }
}

function isXUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "x.com" || host === "twitter.com";
  } catch {
    return false;
  }
}

// X/Twitter's rendered page (unlike YouTube's) still serves proper og:image
// tags to a plain scrape, but for a text-only tweet with no attached photo it
// falls back to the author's small square profile picture instead — not a
// useful "thumbnail", so filter that out by size/aspect ratio.
async function fetchXImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());
    const image = $('meta[property="og:image"]').attr("content");
    if (!image) return null;

    const width = Number($('meta[property="og:image:width"]').attr("content"));
    const height = Number($('meta[property="og:image:height"]').attr("content"));
    const looksLikeProfilePic = width > 0 && width === height && width <= 400;
    return looksLikeProfilePic ? null : image;
  } catch {
    return null;
  }
}

// For a tweet that's just a bare link (no attached photo), the only place a
// meaningful thumbnail could come from is whatever page that link points to.
// Fetching the link directly (rather than resolving then re-fetching) follows
// the t.co redirect chain in one hop. Skips it if the link just points back
// into x.com/twitter.com itself (e.g. an X "Article") since that has no
// og:image of its own either — confirmed by hand, not worth a request for it.
async function fetchImageFromLinkedPage(linkUrl: string): Promise<string | null> {
  try {
    const res = await fetch(linkUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    if (isXUrl(res.url)) return null;

    const $ = cheerio.load(await res.text());
    const image = $('meta[property="og:image"]').attr("content");
    if (!image) return null;
    return new URL(image, res.url).toString();
  } catch {
    return null;
  }
}

// X/Twitter's oEmbed endpoint gives the actual tweet text and author reliably
// (the scraped page's own og:title/description are just "Name (@handle) on X",
// not the tweet content).
async function fetchXOembed(url: string): Promise<OgMetadata | null> {
  try {
    const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const $embed = cheerio.load(data.html ?? "");
    const firstParagraph = $embed("p").first();
    const text = firstParagraph.text().trim();
    const linkedUrl = firstParagraph.find("a").first().attr("href") ?? null;

    let image = await fetchXImage(url);
    if (!image && linkedUrl) {
      image = await fetchImageFromLinkedPage(linkedUrl);
    }

    return {
      title: text.length > 240 ? `${text.slice(0, 240)}…` : text || null,
      image,
      siteName: data.provider_name ?? "X",
      author: data.author_name ?? null,
    };
  } catch {
    return null;
  }
}

// Many PDFs (especially LaTeX-generated papers) don't set the Info dict Title.
// Falls back to guessing from the top of page 1: skips a bare date line if
// present, then joins leading lines until one ends in punctuation or the
// combined guess is long enough to plausibly be a full title.
function guessTitleFromPdfText(text: string): string | null {
  const isDateLike = (line: string) => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(line);
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isDateLike(l))
    .slice(0, 4);
  if (lines.length === 0) return null;

  let title = lines[0];
  let i = 1;
  while (i < lines.length && title.length < 60 && !/[.!?]$/.test(title)) {
    title += ` ${lines[i]}`;
    i++;
  }
  return title.length > 200 ? `${title.slice(0, 200)}…` : title;
}

async function fetchPdfMetadata(buffer: Uint8Array, url: string): Promise<OgMetadata> {
  let siteName: string | null = null;
  try {
    siteName = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // ignore
  }

  // Dynamically imported (rather than at module top-level) and fully wrapped in
  // try/catch: a PDF-parsing failure must never take down non-PDF saves or the
  // whole request — worst case, fall back to a PDF item with just the domain as
  // site name, same as before this existed. unpdf (unlike pdf-parse/pdfjs-dist
  // used directly) avoids canvas/DOMMatrix entirely for text+metadata extraction,
  // which is what actually broke this in Vercel's Node runtime the first time.
  try {
    const { getDocumentProxy, getMeta, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(buffer);
    const info = await getMeta(pdf);
    const metaTitle = typeof info.info?.Title === "string" ? info.info.Title.trim() : "";
    const metaAuthor = typeof info.info?.Author === "string" ? info.info.Author.trim() : "";

    let title: string | null = metaTitle || null;
    if (!title) {
      const { text } = await extractText(pdf, { mergePages: false });
      title = guessTitleFromPdfText(text[0] ?? "");
    }

    return { title, image: null, siteName, author: metaAuthor || null };
  } catch {
    return { title: null, image: null, siteName, author: null };
  }
}

export async function fetchOgMetadata(url: string): Promise<OgMetadata> {
  if (isYouTubeUrl(url)) {
    const oembed = await fetchYouTubeOembed(url);
    if (oembed) return oembed;
  }
  if (isXUrl(url)) {
    const oembed = await fetchXOembed(url);
    if (oembed) return oembed;
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch URL (${res.status})`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf") || url.toLowerCase().endsWith(".pdf")) {
    const buffer = new Uint8Array(await res.arrayBuffer());
    return fetchPdfMetadata(buffer, url);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = meta($, "og:title") ?? $("title").first().text().trim() ?? null;
  const siteName = meta($, "og:site_name");
  const author = meta($, "article:author", "author");
  let image = meta($, "og:image", "og:image:url");
  if (image) {
    try {
      image = new URL(image, url).toString();
    } catch {
      image = null;
    }
  }

  return { title: title || null, image, siteName, author };
}
