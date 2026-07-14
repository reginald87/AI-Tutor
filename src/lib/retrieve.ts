/**
 * Dependency-free, lightweight retrieval for document-grounded chat.
 *
 * Instead of stuffing the entire document into the model context (which makes
 * CPU inference very slow), we split the document into overlapping chunks and
 * return only the few most relevant to the user's question.
 */

export function chunkText(text: string, size = 900, overlap = 120): string[] {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || []);
}

/**
 * Returns the most relevant portion of a document for a given query.
 * For small documents the whole text is returned; otherwise the top-K chunks
 * by term-overlap are returned (preserving original order).
 */
export function retrieveRelevantChunks(
  docText: string | null,
  query: string,
  opts: { maxChunks?: number; chunkSize?: number; overlap?: number; maxChars?: number } = {}
): string {
  if (!docText || !docText.trim()) return "";

  const maxChunks = opts.maxChunks ?? 4;
  const chunkSize = opts.chunkSize ?? 900;
  const overlap = opts.overlap ?? 120;
  const maxChars = opts.maxChars ?? 6000;

  const chunks = chunkText(docText, chunkSize, overlap);
  if (chunks.length <= maxChunks) return docText;

  const qTerms = tokenize(query);
  if (qTerms.length === 0) return chunks.slice(0, maxChunks).join("\n\n");

  const qSet = new Set(qTerms);

  const scored = chunks.map((c, idx) => {
    const terms = tokenize(c);
    const freq = new Map<string, number>();
    for (const t of terms) freq.set(t, (freq.get(t) || 0) + 1);
    let score = 0;
    for (const t of qSet) {
      const f = freq.get(t);
      if (f) score += 1 + Math.log(f); // term frequency with light weighting
    }
    return { idx, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxChunks);

  const joined = top
    .sort((a, b) => a.idx - b.idx)
    .map((t) => chunks[t.idx])
    .join("\n\n---\n\n");

  return joined.length > maxChars ? joined.slice(0, maxChars) + "\n…[truncated]" : joined;
}
