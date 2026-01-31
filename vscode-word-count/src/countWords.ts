export function countWords(text: string): number {
  // Strip common markdown/markup syntax so it doesn't inflate the count.
  const cleaned = text
    // YAML front-matter
    .replace(/^---[\s\S]*?---/m, "")
    // HTML tags
    .replace(/<[^>]+>/g, "")
    // Markdown images ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Markdown links – keep the link text: [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Markdown heading markers, blockquote markers, horizontal rules
    .replace(/^[#>*\-=`~]+\s?/gm, "")
    // Inline code / code fences
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    // Reference-style link definitions – strip only the [id]: marker
    .replace(/^\[[^\]]*\]:\s?/gm, "");

  const matches = cleaned.match(/\S+/g);
  return matches ? matches.length : 0;
}
