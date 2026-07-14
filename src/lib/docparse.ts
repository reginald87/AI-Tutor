import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { CONFIG } from "./config";

const MAX_CHARS = CONFIG.maxContextChars;

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  let text = "";

  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n") : (result.text as string);
    } catch (err) {
      throw new Error("Could not read the PDF file. It may be scanned/image-based.");
    }
  } else if (
    mimeType.includes("word") ||
    mimeType.includes("officedocument") ||
    filename.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    // Plain text and other formats
    text = buffer.toString("utf-8");
  }

  text = (text || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + "\n…[truncated]";
  }
  return text;
}
