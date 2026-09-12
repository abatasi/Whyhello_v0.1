export interface LinkedInSourceData {
  postBody: string | null;
  sharedContent: string | null;
  isReshare: boolean;
  publishedDate: string | null;
  comments: Array<{ author: string; text: string }>;
}

const EMPTY_SOURCE: LinkedInSourceData = {
  postBody: null,
  sharedContent: null,
  isReshare: false,
  publishedDate: null,
  comments: [],
};

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlToText(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function boundedText(value: string | null | undefined, max = 5000): string | null {
  const text = value?.trim();
  return text ? text.slice(0, max) : null;
}

/**
 * Reads public LinkedIn structured data and the visible shared-content block.
 * The caller decides whether the content is relevant; this helper only
 * describes what LinkedIn exposed.
 */
export async function inspectLinkedInSource(url: string): Promise<LinkedInSourceData> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Whyhello-Bot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return EMPTY_SOURCE;
    const html = await response.text();
    const articleBodies: string[] = [];
    const comments: Array<{ author: string; text: string }> = [];
    let publishedDate: string | null = null;

    for (const match of html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis,
    )) {
      try {
        const data = JSON.parse(match[1]);
        const records = Array.isArray(data) ? data : [data];
        for (const record of records) {
          if (!record || typeof record !== "object") continue;
          const value = record as {
            articleBody?: unknown;
            datePublished?: unknown;
            dateCreated?: unknown;
            comment?: unknown;
          };
          if (!publishedDate) {
            const sourceDate = typeof value.datePublished === "string"
              ? value.datePublished
              : typeof value.dateCreated === "string" ? value.dateCreated : null;
            if (sourceDate) publishedDate = sourceDate;
          }
          if (typeof value.articleBody === "string") {
            const body = value.articleBody.trim();
            if (body && !articleBodies.includes(body)) articleBodies.push(body);
          }
          if (Array.isArray(value.comment)) {
            for (const comment of value.comment) {
              if (!comment || typeof comment !== "object") continue;
              const item = comment as {
                text?: unknown;
                author?: { name?: unknown } | string;
              };
              const author = typeof item.author === "string"
                ? item.author
                : typeof item.author?.name === "string" ? item.author.name : "";
              const text = typeof item.text === "string" ? item.text.trim() : "";
              if (author && text && !comments.some((entry) => entry.author === author && entry.text === text)) {
                comments.push({ author, text });
              }
            }
          }
        }
      } catch {
        // Continue with other structured-data blocks.
      }
    }

    const ogDescription = html.match(
      /<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']*)["']/i,
    )?.[1]
      ?? html.match(
        /<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["'](?:og:description|description)["']/i,
      )?.[1];
    const postBody = boundedText(ogDescription ? decodeHtml(ogDescription) : articleBodies.at(-1));

    const sharedMatch = html.match(
      /<[^>]+data-test-id=["']feed-reshare-content__commentary["'][^>]*>([\s\S]*?)<\/(?:p|div)>/i,
    );
    const sharedContent = boundedText(sharedMatch ? htmlToText(sharedMatch[1]) : null);

    return {
      postBody,
      sharedContent: sharedContent ?? (
        articleBodies.find((body) => body !== postBody) ? boundedText(articleBodies.find((body) => body !== postBody)) : null
      ),
      isReshare: Boolean(sharedContent),
      publishedDate,
      comments,
    };
  } catch {
    return EMPTY_SOURCE;
  }
}