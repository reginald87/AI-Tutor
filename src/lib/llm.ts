import { CONFIG } from "./config";

export const TUTOR_SYSTEM = `You are ${CONFIG.appName}, the official AI learning companion for Bayelsa Medical University (BMU) students.

Your goals:
- Help students understand their coursework using clear, accurate, and encouraging explanations.
- When lecture-note context is provided, answer strictly from that material and cite it; if the answer is not in the notes, say so and give a careful general explanation.
- Favour a medical/clinical academic tone appropriate for health-sciences students.
- Keep answers well-structured with bullet points, step lists, or short paragraphs when helpful.
- Never invent facts presented as coming from the student's notes.
- If a question is unsafe, unethical, or outside an educational scope, politely decline.`;

export interface QuizSpec {
  title: string;
  description?: string;
  count?: number;
  level?: string | null;
  department?: string | null;
  faculty?: string | null;
  docText?: string | null;
}

export function buildQuizPrompt(spec: QuizSpec): { system: string; user: string } {
  const count = Math.min(Math.max(spec.count ?? 5, 1), 20);
  const context = spec.docText
    ? `Use the following lecture notes as the SOLE source of questions:\n\n"""\n${spec.docText}\n"""`
    : `Create general ${spec.department ? spec.department + " " : ""}questions appropriate for a ${
        spec.level || "university"
      } level health-sciences student.`;

  const sys = `You are an exam question author for Bayelsa Medical University.
Return ONLY valid JSON of the shape:
{
  "title": string,
  "description": string,
  "questions": [
    {
      "prompt": string,
      "options": [string, string, string, string],
      "correctIndex": integer (0-3),
      "explanation": string
    }
  ]
}
Rules:
- Provide exactly ${count} multiple-choice questions.
- Each question has exactly 4 options and exactly one correct answer.
- "correctIndex" is the zero-based index of the correct option.
- "explanation" must justify the correct answer briefly.
- Do not include any text outside the JSON.`;

  const user = `${context}\n\nGenerate ${count} questions.${
    spec.title ? `\nTitle suggestion: ${spec.title}.` : ""
  }`;

  return { system: sys, user };
}

export function buildFlashcardPrompt(spec: {
  title?: string;
  count?: number;
  docText?: string | null;
  topic?: string | null;
}): { system: string; user: string } {
  const count = Math.min(Math.max(spec.count ?? 8, 1), 30);
  const context = spec.docText
    ? `Use the following lecture notes as the SOLE source:\n\n"""\n${spec.docText}\n"""`
    : `Create general study flashcards appropriate for a health-sciences student${
        spec.topic ? ` about: ${spec.topic}` : ""
      }.`;

  const sys = `You are a study-coach for Bayelsa Medical University.
Return ONLY valid JSON of the shape:
{
  "title": string,
  "cards": [
    { "front": string, "back": string }
  ]
}
Rules:
- Provide exactly ${count} flashcards.
- "front" is a concise question or term.
- "back" is the answer/definition, brief and accurate.
- Do not include any text outside the JSON.`;

  const user = `${context}\n\nGenerate ${count} flashcards.${
    spec.title ? `\nDeck title suggestion: ${spec.title}.` : ""
  }`;

  return { system: sys, user };
}

export function buildChatMessages(
  history: { role: "user" | "assistant"; content: string }[],
  docText: string | null,
  opts: { withConfidence?: boolean } = {}
): { role: "system" | "user" | "assistant"; content: string }[] {
  let system = docText
    ? `${TUTOR_SYSTEM}\n\nThe student has shared lecture notes. Use them as primary context:\n\n"""\n${docText}\n"""`
    : TUTOR_SYSTEM;

  if (opts.withConfidence) {
    system +=
      "\n\nBefore your answer, on the very first line, output exactly one of:" +
      " [CONF:high], [CONF:medium], or [CONF:low] to rate how confident you are" +
      " in this answer (high = directly from the notes/solid fact, medium = reasonable" +
      " but worth verifying, low = uncertain or not covered). Then start your answer" +
      " on the next line. Do not mention the tag in your answer.";
  }

  return [{ role: "system", content: system }, ...history];
}

const CONF_RE = /^\[(CONF|conf):\s*(high|medium|low)\]\s*/;

/**
 * Detects and strips a leading [CONF:...] tag from streamed chat text.
 * Returns the cleaned text and the detected confidence (or null).
 */
export function stripConfidence(text: string): { text: string; confidence: string | null } {
  const m = text.match(CONF_RE);
  if (!m) return { text, confidence: null };
  return { text: text.replace(CONF_RE, ""), confidence: m[2].toLowerCase() };
}
