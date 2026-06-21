// Estimate reading time from Markdown source. CJK characters and Latin words
// are counted separately (different reading speeds), then combined.
const CJK = /[一-鿿㐀-䶿豈-﫿]/g

export function readingMinutes(markdown: string): number {
  if (!markdown) return 1
  const cjkCount = (markdown.match(CJK) || []).length
  const wordCount = (markdown.replace(CJK, ' ').match(/[A-Za-z0-9]+/g) || []).length
  const minutes = cjkCount / 350 + wordCount / 220
  return Math.max(1, Math.round(minutes))
}
