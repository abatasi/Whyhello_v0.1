/** Safe subset shared with outreach email rendering: bold, http(s) links, and paragraphs. */
export function emailMarkdownToHtml(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;color:inherit;opacity:0.85;">$1</a>',
  );
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  return html.split(/\n{2,}/).map(para => `<p style="margin:0 0 1em 0;">${para.replace(/\n/g, "<br>")}</p>`).join("");
}