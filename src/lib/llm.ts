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

export function buildChatMessages(
  history: { role: "user" | "assistant"; content: string }[],
  docText: string | null
): { role: "system" | "user" | "assistant"; content: string }[] {
  const system = docText
    ? `${TUTOR_SYSTEM}\n\nThe student has shared lecture notes. Use them as primary context:\n\n"""\n${docText}\n"""`
    : TUTOR_SYSTEM;

  return [{ role: "system", content: system }, ...history];
}
