export interface SanitizedQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface RawQuestion {
  prompt?: string;
  question?: string;
  options?: unknown;
  correctIndex?: number;
  answer?: number;
  correctAnswer?: number;
  explanation?: string;
}

export function sanitizeQuestions(input: unknown): SanitizedQuestion[] {
  if (!Array.isArray(input)) return [];
  const out: SanitizedQuestion[] = [];

  for (const q of input) {
    const item = q as RawQuestion;
    const prompt = String(item.prompt || item.question || "").trim();
    if (!prompt) continue;

    let options: string[] = [];
    if (Array.isArray(item.options)) {
      options = item.options.map((o) => String(o).trim()).filter(Boolean);
    } else if (item.options && typeof item.options === "object") {
      options = Object.values(item.options)
        .map((o) => String(o).trim())
        .filter(Boolean);
    }
    if (options.length < 2) continue;

    let correctIndex = Number(item.correctIndex ?? item.answer ?? item.correctAnswer);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = 0;
    }

    out.push({
      prompt,
      options,
      correctIndex,
      explanation: String(item.explanation || "").trim(),
    });
  }

  return out;
}

export function sanitizeQuiz(raw: any): {
  title: string;
  description: string;
  questions: SanitizedQuestion[];
} {
  const questions = sanitizeQuestions(raw?.questions);
  return {
    title: String(raw?.title || "Generated Quiz").slice(0, 160),
    description: raw?.description ? String(raw.description).slice(0, 500) : "",
    questions,
  };
}
