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
  sources?: { filename: string | null; snippet: string }[];
  confidence?: string | null;
  image?: string;
}

export default function ChatWindow() {
  const { prompts, refresh, user } = useAuth();

  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  useEffect(() => {
    inputRef.current = input;
  }, [input]);
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
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const imageRef = useRef<HTMLInputElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [wakeListening, setWakeListening] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const wakeRecognitionRef = useRef<any>(null);
  const autoSendTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<string>("");
  const voiceModeRef = useRef(false);
  const wakeListeningRef = useRef(false);

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

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    wakeListeningRef.current = wakeListening;
  }, [wakeListening]);

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

  async function sendMessage(overrideText?: string) {
    const text = (overrideText !== undefined ? overrideText : input).trim();
    const hasImage = !!image;
    if ((!text && !hasImage) || busy) return;
    if (prompts?.exhausted) {
      setError("You have no prompts left. They refill daily and weekly.");
      return;
    }

    setError("");
    if (overrideText === undefined) {
      setInput("");
    }
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      image: hasImage ? image || undefined : undefined,
    };
    const assistantMsg: Msg = { id: `a-${Date.now()}`, role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setBusy(true);

    const sentImage = hasImage ? image : null;
    if (hasImage && overrideText === undefined) {
      setImage(null);
      setImageName("");
    } else if (hasImage) {
      // If sending with override, clear image too
      setImage(null);
      setImageName("");
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChatId,
          message: text,
          image: sentImage,
          docId: activeDocId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Request failed");
      }

      const returnedChatId = res.headers.get("X-Chat-Id");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let meta: { confidence: string | null; sources: any[] } | null = null;

      const parseStream = (raw: string) => {
        const start = raw.lastIndexOf("@@META@@");
        if (start === -1) return { content: raw, meta: null };
        const end = raw.indexOf("@@META@@", start + 8);
        if (end === -1) return { content: raw, meta: null };
        const json = raw.slice(start + 8, end);
        let m: any = null;
        try {
          m = JSON.parse(json);
        } catch {
          m = null;
        }
        return { content: raw.slice(0, start), meta: m };
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        const parsed = parseStream(full);
        if (parsed.meta) meta = parsed.meta;
        setMessages((prev) =>
          prev.map((mm) => (mm.id === assistantMsg.id ? { ...mm, content: parsed.content } : mm))
        );
      }

      const finalParsed = parseStream(full);
      setMessages((prev) =>
        prev.map((mm) =>
          mm.id === assistantMsg.id
            ? {
                ...mm,
                content: finalParsed.content,
                sources: finalParsed.meta?.sources || meta?.sources || undefined,
                confidence: finalParsed.meta?.confidence || meta?.confidence || undefined,
              }
            : mm
        )
      );

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

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImage(result.split(",")[1] || null);
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
    if (imageRef.current) imageRef.current.value = "";
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
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || (window as any).msSpeechRecognition;
    if (!SR) {
      setError("Speech input is not supported in this browser. Try Microsoft Edge (Chromium), Chrome, or ensure you're on HTTPS/localhost.");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext && location.hostname !== "localhost") {
      setError("Speech recognition requires a secure context (HTTPS). Open this site over HTTPS.");
      return;
    }
    if (listening) {
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = null;
      }
      try {
        recognitionRef.current?.abort?.() || recognitionRef.current?.stop?.();
      } catch {}
      setListening(false);
      return;
    }
    startRecognition(false);
  }

  function startRecognition(useContinuous = true, triedFallback = false) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || (window as any).msSpeechRecognition;
    if (!SR) {
      setError("Speech input is not supported in this browser. Try Microsoft Edge, Chrome, or Chromium-based browsers.");
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = useContinuous;
      if (typeof rec.maxAlternatives !== "undefined") {
        rec.maxAlternatives = 1;
      }

      let gotResult = false;

      rec.onstart = () => {
        setListening(true);
        setError("");
      };

      rec.onresult = (e: any) => {
        gotResult = true;
        let transcript = "";
        for (let i = 0; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        setInput(transcript);
        if (autoSendTimeoutRef.current) {
          clearTimeout(autoSendTimeoutRef.current);
        }
        autoSendTimeoutRef.current = setTimeout(() => {
          const finalText = transcript.trim();
          if (finalText && !prompts?.exhausted) {
            if (autoSendTimeoutRef.current) {
              clearTimeout(autoSendTimeoutRef.current);
              autoSendTimeoutRef.current = null;
            }
            try {
              recognitionRef.current?.abort?.() || recognitionRef.current?.stop?.();
            } catch {}
            setListening(false);
            setInput("");
            sendMessage(finalText);
          } else {
            if (autoSendTimeoutRef.current) {
              clearTimeout(autoSendTimeoutRef.current);
              autoSendTimeoutRef.current = null;
            }
          }
        }, 2000);
      };
      rec.onend = () => {
        setListening(false);
        // If we started in continuous mode but got no results and it ended immediately, try non-continuous fallback
        if (useContinuous && !triedFallback && !gotResult) {
          if (autoSendTimeoutRef.current) {
            clearTimeout(autoSendTimeoutRef.current);
            autoSendTimeoutRef.current = null;
          }
          try {
            startRecognition(false, true);
            return;
          } catch {}
        }
        if (autoSendTimeoutRef.current) {
          clearTimeout(autoSendTimeoutRef.current);
          autoSendTimeoutRef.current = null;
        }
        if (voiceModeRef.current && !wakeListeningRef.current) {
          setTimeout(() => {
            if (voiceModeRef.current && !listening) {
              startWakeWordListener();
            }
          }, 400);
        }
      };
      rec.onerror = (e: any) => {
        setListening(false);
        if (autoSendTimeoutRef.current) {
          clearTimeout(autoSendTimeoutRef.current);
          autoSendTimeoutRef.current = null;
        }
        const err = e?.error || "";
        if (err === "not-allowed" || err === "service-not-allowed") {
          setError("Microphone permission denied. Allow mic access in browser/site settings.");
          return;
        }
        if (err === "audio-capture") {
          setError("No microphone found. If using a Bluetooth mic, connect it and set it as the default input device.");
          return;
        }
        if (err === "no-speech") {
          // Common on some devices - don't spam error
          return;
        }
        if (err === "network") {
          setError("Speech recognition network error. Some browsers/tablets need a stable network or different browser (try Microsoft Edge/Chrome).");
          return;
        }
        if (err === "aborted") {
          return;
        }
        if (useContinuous && !triedFallback) {
          try {
            startRecognition(false, true);
            return;
          } catch {}
        }
        if (voiceModeRef.current) {
          setTimeout(() => {
            if (voiceModeRef.current && !listening) {
              startWakeWordListener();
            }
          }, 800);
          return;
        }
        setError(`Speech recognition error (${err || "unknown"}). Try again or use Microsoft Edge/Chrome over HTTPS.`);
      };
      recognitionRef.current = rec;
      try {
        rec.start();
      } catch (err) {
        if (useContinuous && !triedFallback) {
          try {
            startRecognition(false, true);
            return;
          } catch {}
        }
        setError("Could not start speech input. Try again or use a different browser.");
        setListening(false);
      }
    } catch (err) {
      setError("Could not start speech input.");
      setListening(false);
    }
  }

  const WAKE_WORDS = ["hey tutor", "hi tutor", "hello tutor", "ai tutor", "hey ai tutor", "hello ai tutor", "ok tutor"];

  function startWakeWordListener(triedFallback = false) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || (window as any).msSpeechRecognition;
    if (!SR) return;
    if (typeof window !== "undefined" && !window.isSecureContext && location.hostname !== "localhost") return;
    if (wakeRecognitionRef.current) {
      try {
        wakeRecognitionRef.current.abort?.();
      } catch {}
    }
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = !triedFallback;
      if (typeof rec.maxAlternatives !== "undefined") rec.maxAlternatives = 1;

      rec.onstart = () => {
        setWakeListening(true);
      };

      rec.onresult = (e: any) => {
        let transcript = "";
        for (let i = e.resultIndex >= 0 ? e.resultIndex : 0; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        const lower = transcript.toLowerCase();
        if (WAKE_WORDS.some((w) => lower.includes(w))) {
          try {
            wakeRecognitionRef.current?.abort?.();
          } catch {}
          setWakeListening(false);
          if (!voiceModeRef.current) {
            setVoiceMode(true);
          }
          setTimeout(() => {
            startRecognition(true);
          }, 100);
        }
      };

      rec.onend = () => {
        setWakeListening(false);
        if (voiceModeRef.current && !listening) {
          setTimeout(() => {
            if (voiceModeRef.current && !listening) {
              startWakeWordListener(triedFallback);
            }
          }, 500);
        }
      };

      rec.onerror = (e: any) => {
        setWakeListening(false);
        const err = e?.error || "";
        if (err === "not-allowed" || err === "service-not-allowed") {
          setError("Microphone permission denied. Allow mic access in browser/site settings.");
          return;
        }
        if (err === "audio-capture") {
          setError("No microphone found. If using a Bluetooth mic, connect it and set it as the default input device.");
          return;
        }
        if (err === "no-speech" || err === "aborted") {
          // Don't show error, just restart
        }
        if (voiceModeRef.current && !listening) {
          setTimeout(() => {
            if (voiceModeRef.current && !listening) {
              if (!triedFallback && err !== "not-allowed" && err !== "audio-capture") {
                startWakeWordListener(true);
              } else {
                startWakeWordListener(triedFallback);
              }
            }
          }, 1000);
        }
      };

      wakeRecognitionRef.current = rec;
      rec.start();
    } catch {
      setWakeListening(false);
      if (voiceModeRef.current && !listening && !triedFallback) {
        setTimeout(() => {
          startWakeWordListener(true);
        }, 1000);
      }
    }
  }

  function toggleVoiceMode() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || (window as any).msSpeechRecognition;
    if (!SR) {
      setError("Speech input is not supported in this browser. Try Microsoft Edge, Chrome, or Chromium-based browsers.");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext && location.hostname !== "localhost") {
      setError("Speech recognition requires a secure context (HTTPS). Open this site over HTTPS.");
      return;
    }
    if (voiceMode) {
      setVoiceMode(false);
      try {
        wakeRecognitionRef.current?.abort?.();
      } catch {}
      setWakeListening(false);
      if (listening) {
        if (autoSendTimeoutRef.current) {
          clearTimeout(autoSendTimeoutRef.current);
          autoSendTimeoutRef.current = null;
        }
        try {
          recognitionRef.current?.abort?.() || recognitionRef.current?.stop?.();
        } catch {}
        setListening(false);
      }
      return;
    }
    setVoiceMode(true);
    startWakeWordListener();
  }

  useEffect(() => {
    return () => {
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
      }
      try {
        recognitionRef.current?.stop?.();
      } catch {}
      try {
        wakeRecognitionRef.current?.abort?.();
      } catch {}
    };
  }, []);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:gap-3 sm:px-5">
        <button onClick={newChat} className="btn-outline">
          + New chat
        </button>
        <button
          onClick={() => setShowHistory((s) => !s)}
          className={`btn-outline ${showHistory ? "bg-slate-100" : ""}`}
          title="Conversation history"
        >
          🕘 History
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

        <button
          onClick={() => imageRef.current?.click()}
          title="Send a photo (whiteboard, diagram)"
          className="btn-ghost"
        >
          📷 Photo
        </button>
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onPickImage}
        />

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

      {/* Conversation history drawer */}
      {showHistory && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 md:bg-transparent"
          onClick={() => setShowHistory(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ${
          showHistory ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 pt-14 md:pt-3">
          <span className="font-semibold text-slate-800">Your chats</span>
          <button
            onClick={() => setShowHistory(false)}
            aria-label="Close history"
            className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="scroll-thin flex-1 space-y-1 overflow-y-auto p-2">
          <button
            onClick={() => {
              newChat();
              setShowHistory(false);
            }}
            className="btn-outline mb-2 w-full justify-start"
          >
            + New chat
          </button>
          {chats.length === 0 ? (
            <p className="p-2 text-sm text-slate-400">No chats yet.</p>
          ) : (
            chats.map((c: any) => (
              <button
                key={c.id}
                onClick={() => {
                  loadChat(c.id);
                  setShowHistory(false);
                }}
                className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                  activeChatId === c.id ? "bg-accent-50 text-accent-700" : "text-slate-700"
                }`}
              >
                {c.title}
              </button>
            ))
          )}
        </div>
      </aside>

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
                      <div className="mt-1 flex flex-wrap items-center gap-3">
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
                        {m.confidence && (
                          <span
                            title="AI confidence in this answer"
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              m.confidence === "high"
                                ? "bg-green-100 text-green-700"
                                : m.confidence === "medium"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {m.confidence === "high" ? "✓ Confident" : m.confidence === "medium" ? "〜 Fairly sure" : "⚠ Uncertain"}
                          </span>
                        )}
                      </div>
                      {m.sources && m.sources.length > 0 && (
                        <details className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-medium text-slate-500">
                            📚 Sources ({m.sources.length})
                          </summary>
                          <ul className="mt-2 space-y-2">
                            {m.sources.map((s: any, i: number) => (
                              <li key={i} className="text-xs text-slate-600">
                                <div className="font-medium text-slate-500">
                                  📄 {s.filename || "Notes"}
                                </div>
                                <p className="mt-0.5 line-clamp-4 italic text-slate-500">
                                  “{s.snippet}”
                                </p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                   </>
                ) : (
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-pulse-dot rounded-full bg-slate-300" />
                    <span className="h-2 w-2 animate-pulse-dot rounded-full bg-slate-300 [animation-delay:0.2s]" />
                    <span className="h-2 w-2 animate-pulse-dot rounded-full bg-slate-300 [animation-delay:0.4s]" />
                  </span>
                )
              ) : (
                <>
                  {m.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/*;base64,${m.image}`}
                      alt="Attachment"
                      className="mb-2 max-h-48 rounded-lg border border-white/30"
                    />
                  )}
                  {m.content}
                </>
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
            <button
              onClick={toggleVoiceMode}
              title={voiceMode ? "Exit voice mode (say 'Hey Tutor')" : "Enter voice mode - say 'Hey Tutor'"}
              className={`btn ${voiceMode ? "bg-brand-600 text-white" : "btn-outline"} px-3`}
            >
              {voiceMode ? (wakeListening ? "● Wake" : "🎙 Voice") : "🗣 Voice Mode"}
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
              onClick={() => sendMessage()}
              disabled={busy || (!input.trim() && !image)}
              className="btn-primary px-4"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
          {image && (
            <div className="mx-auto mt-2 flex max-w-3xl items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/*;base64,${image}`}
                alt="To send"
                className="h-12 w-12 rounded object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                {imageName || "Photo attached"}
              </span>
              <button
                onClick={() => {
                  setImage(null);
                  setImageName("");
                }}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          )}
          <p className="mx-auto mt-1 max-w-3xl text-center text-[11px] text-slate-400">
            BMU AI Tutor can make mistakes. Verify important information with your lecture notes.
          </p>
        </div>
      )}
    </div>
  );
}
