"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiUpload } from "@/lib/api";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatWindow() {
  const { prompts, refresh, user } = useAuth();

  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [rate, setRate] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load initial data + optional ?chat= query.
  // Reset everything when the signed-in user changes so one account never
  // shows another account's chats, documents, or prompt usage.
  useEffect(() => {
    setChats([]);
    setMessages([]);
    setActiveChatId(null);
    setActiveDocId(null);
    setError("");

    apiGet("/api/chats")
      .then((d) => setChats(d.chats || []))
      .catch(() => {});
    apiGet("/api/documents")
      .then((d) => setDocuments(d.documents || []))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const chatParam = params.get("chat");
    if (chatParam) loadChat(chatParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load available TTS voices + saved preferences
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    const savedVoice = localStorage.getItem("bmu_voice_uri");
    if (savedVoice) setVoiceURI(savedVoice);
    const savedRate = localStorage.getItem("bmu_voice_rate");
    if (savedRate) setRate(parseFloat(savedRate) || 1);
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function loadChat(id: string) {
    setError("");
    try {
      const d = await apiGet(`/api/chats/${id}`);
      setActiveChatId(id);
      setMessages(
        d.chat.messages.map((m: any) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }))
      );
      setActiveDocId(d.chat.activeDoc?.id || null);
    } catch {
      setError("Could not load that chat.");
    }
  }

  function newChat() {
    setActiveChatId(null);
    setMessages([]);
    setActiveDocId(null);
    setError("");
    window.history.replaceState(null, "", "/dashboard/chat");
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;
    if (prompts?.exhausted) {
      setError("You have no prompts left. They refill daily and weekly.");
      return;
    }

    setError("");
    setInput("");
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantMsg: Msg = { id: `a-${Date.now()}`, role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: activeChatId, message: text, docId: activeDocId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Request failed");
      }

      const returnedChatId = res.headers.get("X-Chat-Id");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: full } : m))
        );
      }

      await refresh();
      if (!activeChatId && returnedChatId) {
        setActiveChatId(returnedChatId);
        window.history.replaceState(null, "", `/dashboard/chat?chat=${returnedChatId}`);
        apiGet("/api/chats").then((d) => setChats(d.chats || []));
      }
      if (autoSpeak) speak(assistantMsg.id, full);
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: m.content || `⚠️ ${err.message || "Generation failed."}` }
            : m
        )
      );
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await apiUpload("/api/documents", fd);
      setDocuments((prev) => [d.document, ...prev]);
      setActiveDocId(d.document.id);
    } catch (err: any) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ---- TTS ----
  function speak(id: string, text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[#*`>]/g, ""));
    u.rate = rate;
    const chosen = voices.find((v) => v.voiceURI === voiceURI);
    if (chosen) u.voice = chosen;
    u.onend = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(u);
  }
  function stopSpeak() {
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }

  function copyText(id: string, text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    });
  }

  // ---- STT ----
  function toggleListen() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Speech input is not supported in this browser.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-NG";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:gap-3 sm:px-5">
        <button onClick={newChat} className="btn-outline">
          + New chat
        </button>

        <select
          value={activeDocId || ""}
          onChange={(e) => setActiveDocId(e.target.value || null)}
          className="input min-w-0 flex-1 py-1.5 text-sm sm:flex-none sm:max-w-xs"
        >
          <option value="">No document attached</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              📄 {d.filename}
            </option>
          ))}
        </select>

        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-ghost">
          {uploading ? "Uploading…" : "⬆ Upload notes"}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={onUpload} />

        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(e) => setAutoSpeak(e.target.checked)}
              className="accent-brand-600"
            />
            🔊 Read responses aloud
          </label>

          <div className="flex items-center gap-1.5" title="Voice for text-to-speech">
            <span className="text-sm text-slate-500">🔈</span>
            <select
              value={voiceURI}
              onChange={(e) => {
                setVoiceURI(e.target.value);
                if (e.target.value) localStorage.setItem("bmu_voice_uri", e.target.value);
                else localStorage.removeItem("bmu_voice_uri");
              }}
              className="input w-full py-1 text-xs sm:max-w-[200px]"
            >
              <option value="">System default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5" title="Speech speed">
            <span className="text-sm text-slate-500">⏩</span>
            <select
              value={rate}
              onChange={(e) => {
                const r = parseFloat(e.target.value);
                setRate(r);
                localStorage.setItem("bmu_voice_rate", String(r));
              }}
              className="input py-1 text-xs"
            >
              <option value={0.75}>0.75×</option>
              <option value={1}>1×</option>
              <option value={1.25}>1.25×</option>
              <option value={1.5}>1.5×</option>
              <option value={2}>2×</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scroll-thin flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl pt-10 text-center">
            <div className="text-4xl">🤖</div>
            <h2 className="mt-3 text-xl font-semibold text-slate-800">How can I help you study?</h2>
            <p className="mt-2 text-sm text-slate-500">
              Ask anything, or upload your lecture notes and ask questions about them. Each reply uses
              one prompt.
            </p>
            {activeDocId && (
              <p className="mt-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                📄 Notes attached — answers will use your document.
              </p>
            )}
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`mx-auto flex max-w-3xl gap-3 ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {m.role === "assistant" && (
              <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-white">
                🤖
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-brand-600 text-white"
                  : "border border-slate-200 bg-white text-slate-800"
              }`}
            >
              {m.role === "assistant" ? (
                m.content ? (
                  <>
                     <div className="md">
                       <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                     </div>
                     <div className="mt-1 flex items-center gap-3">
                       <button
                         onClick={() => (speakingId === m.id ? stopSpeak() : speak(m.id, m.content))}
                         className="text-xs text-slate-400 hover:text-brand-600"
                       >
                         {speakingId === m.id ? "⏹ Stop" : "🔊 Read"}
                       </button>
                       <button
                         onClick={() => copyText(m.id, m.content)}
                         className="text-xs text-slate-400 hover:text-brand-600"
                       >
                         {copiedId === m.id ? "✓ Copied" : "📋 Copy"}
                       </button>
                     </div>
                  </>
                ) : (
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-pulse-dot rounded-full bg-slate-300" />
                    <span className="h-2 w-2 animate-pulse-dot rounded-full bg-slate-300 [animation-delay:0.2s]" />
                    <span className="h-2 w-2 animate-pulse-dot rounded-full bg-slate-300 [animation-delay:0.4s]" />
                  </span>
                )
              ) : (
                m.content
              )}
            </div>
            {m.role === "user" && (
              <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                {(user?.name || "U").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      {!user?.verified ? (
        <div className="border-t border-slate-200 bg-white px-4 py-6">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="text-lg">✉️</span>
            <p>
              Verify your email to start chatting. Check your inbox for the activation link (or ask an
              administrator to activate your account).
            </p>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <button
              onClick={toggleListen}
              title="Speak your question"
              className={`btn ${listening ? "bg-red-500 text-white" : "btn-outline"} px-3`}
            >
              {listening ? "● Listening" : "🎤"}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              placeholder={
                prompts?.exhausted
                  ? "No prompts left — they refill soon."
                  : "Ask a question… (Enter to send)"
              }
              className="input max-h-40 flex-1 resize-none"
              disabled={busy || !!prompts?.exhausted}
            />
            <button
              onClick={sendMessage}
              disabled={busy || !input.trim()}
              className="btn-primary px-4"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
          <p className="mx-auto mt-1 max-w-3xl text-center text-[11px] text-slate-400">
            BMU AI Tutor can make mistakes. Verify important information with your lecture notes.
          </p>
        </div>
      )}
    </div>
  );
}
