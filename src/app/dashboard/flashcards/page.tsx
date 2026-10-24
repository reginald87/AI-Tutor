"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiPost, apiDelete, pollUntil } from "@/lib/api";

interface FlashcardDeck {
  id: string;
  title: string;
  createdAt: string;
  sourceDocId: string | null;
  sourceQuizId: string | null;
  status: string;
  error: string | null;
  _count: { cards: number };
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  dueAt: string;
  interval: number;
  repetitions: number;
}

interface DeckDetail {
  id: string;
  title: string;
  cards: Flashcard[];
}

interface DocumentItem {
  id: string;
  filename: string;
}

export default function FlashcardsPage() {
  const { prompts, refresh } = useAuth();

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [fromDoc, setFromDoc] = useState("");
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [activeDeck, setActiveDeck] = useState<DeckDetail | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [f, d] = await Promise.all([
        apiGet("/api/flashcards").catch(() => ({ decks: [] })),
        apiGet("/api/documents").catch(() => ({ documents: [] })),
      ]);
      setDecks(f.decks || []);
      setDocuments(d.documents || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDeck(id: string) {
    setActiveLoading(true);
    setError("");
    try {
      const res = await apiGet<{ deck: DeckDetail }>(`/api/flashcards/${id}`);
      setActiveDeck(res.deck);
      setCardIndex(0);
      setShowAnswer(false);
      setReviewDone(false);
    } catch (err: any) {
      setError(err.message || "Could not open deck.");
    } finally {
      setActiveLoading(false);
    }
  }

  function closeDeck() {
    setActiveDeck(null);
    setReviewDone(false);
    setShowAnswer(false);
    load();
  }

  async function generate() {
    setError("");
    if (!fromDoc && !topic.trim()) {
      setError("Choose a document or enter a topic.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ deckId: string }>("/api/flashcards", {
        title: title || undefined,
        topic: topic || undefined,
        fromDoc: fromDoc || undefined,
        count,
      });
      setError("Generating deck… this can take a few minutes on the server.");
      await pollUntil(async () => {
        const data = await apiGet<{ decks: FlashcardDeck[] }>("/api/flashcards");
        const deck = data.decks.find((d) => d.id === res.deckId);
        if (deck?.status === "FAILED") {
          throw new Error(deck.error || "Flashcard generation failed. Please try again.");
        }
        return deck?.status === "PUBLISHED" && (deck._count?.cards ?? 0) > 0;
      });
      setError("");
      await refresh();
      await openDeck(res.deckId);
    } catch (err: any) {
      setError(err.message || "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDeck(id: string) {
    if (!confirm("Delete this deck?")) return;
    await apiDelete(`/api/flashcards/${id}`).catch(() => {});
    load();
  }

  async function rate(rating: number) {
    if (!activeDeck) return;
    const card = activeDeck.cards[cardIndex];
    try {
      await apiPost(`/api/flashcards/${activeDeck.id}/review`, { cardId: card.id, rating });
    } catch {
      // continue advancing even if review call fails
    }
    const next = cardIndex + 1;
    if (next >= activeDeck.cards.length) {
      setReviewDone(true);
    } else {
      setCardIndex(next);
      setShowAnswer(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-800">Flashcards</h1>
      <p className="mt-1 text-sm text-slate-500">
        Generate decks from your notes or a topic, then study them with spaced repetition.
      </p>

      {activeDeck ? (
        <div className="mt-6">
          <button onClick={closeDeck} className="btn-outline mb-4">
            ← Back to decks
          </button>

          {activeLoading ? (
            <p className="text-sm text-slate-500">Loading deck…</p>
          ) : reviewDone ? (
            <div className="card p-8 text-center">
              <div className="text-4xl">🎉</div>
              <h2 className="mt-3 text-xl font-semibold text-slate-800">All done!</h2>
              <p className="mt-1 text-sm text-slate-500">
                You reviewed all {activeDeck.cards.length} cards in “{activeDeck.title}”.
              </p>
              <button onClick={closeDeck} className="btn-primary mt-5">
                Finish
              </button>
            </div>
          ) : (
            (() => {
              const card = activeDeck.cards[cardIndex];
              if (!card) return null;
              return (
                <div className="card p-6">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                    <span>
                      {cardIndex + 1} / {activeDeck.cards.length}
                    </span>
                    <span>{activeDeck.title}</span>
                  </div>

                  <div className="mt-4 perspective-1000">
                    <div
                      className={`relative h-48 w-full cursor-pointer transition-transform duration-500 transform-style-preserve-3d ${showAnswer ? "rotate-y-180" : ""}`}
                      onClick={() => setShowAnswer((s) => !s)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setShowAnswer((s) => !s);
                        }
                      }}
                    >
                      <div className="absolute inset-0 backface-hidden rounded-xl border border-slate-200 bg-slate-50 p-6">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Front</p>
                        <p className="mt-2 text-lg font-medium text-slate-800">{card.front}</p>
                        <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-slate-400">Click to flip</p>
                      </div>
                      <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-xl border border-brand-200 bg-brand-50 p-6">
                        <p className="text-xs uppercase tracking-wide text-brand-500">Back</p>
                        <p className="mt-2 text-lg text-slate-800">{card.back}</p>
                        <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-brand-400">Click to flip back</p>
                      </div>
                    </div>
                  </div>

                  {!showAnswer && (
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="btn-outline mt-4 w-full"
                    >
                      Show answer
                    </button>
                  )}

                  {showAnswer && (
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <button onClick={() => rate(1)} className="btn-outline">
                        Again
                      </button>
                      <button onClick={() => rate(3)} className="btn-outline">
                        Hard
                      </button>
                      <button onClick={() => rate(4)} className="btn">
                        Good
                      </button>
                      <button onClick={() => rate(5)} className="btn-primary">
                        Easy
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Generator */}
          <div className="card h-fit p-5">
            <h2 className="font-semibold text-slate-800">Generate flashcards</h2>
            <p className="mt-1 text-xs text-slate-400">Costs 1 prompt.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Title (optional)
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="Cardiovascular system"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  From a document
                </label>
                <select
                  value={fromDoc}
                  onChange={(e) => setFromDoc(e.target.value)}
                  className="input"
                >
                  <option value="">— None (use a topic) —</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename}
                    </option>
                  ))}
                </select>
                {documents.length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    No documents yet. Upload notes in the chat first.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  …or a topic
                </label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="input"
                  placeholder="Explain the process of glycolysis"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Number of cards: {count}
                </label>
                <input
                  type="range"
                  min={3}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={generate}
                disabled={busy || !!prompts?.exhausted}
                className="btn-primary w-full"
              >
                {busy ? "Generating…" : "Generate flashcards"}
              </button>
            </div>
          </div>

          {/* Deck list */}
          <div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading decks…</p>
            ) : decks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                No flashcard decks yet. Generate one from the form.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {decks.map((deck) => (
                  <div
                    key={deck.id}
                    className="card block p-4 text-left transition hover:border-brand-300 hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => openDeck(deck.id)}
                        disabled={deck.status !== "PUBLISHED"}
                        className="min-w-0 text-left"
                      >
                        <h3 className="font-semibold text-slate-800">{deck.title}</h3>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {deck.status === "GENERATING" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Generating…
                          </span>
                        )}
                        {deck.status === "FAILED" && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Failed
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {deck._count?.cards ?? 0} cards
                        </span>
                        <button
                          onClick={() => removeDeck(deck.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                          title="Delete deck"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {deck.status === "FAILED" && deck.error && (
                      <p className="mt-1 text-xs text-red-500">{deck.error}</p>
                    )}
                    {deck.status !== "FAILED" && (
                      <p className="mt-1 text-xs text-slate-400">
                        Created {new Date(deck.createdAt).toLocaleDateString()}
                      </p>
                    )}
                    <div className="mt-3 text-xs font-medium text-brand-600">
                      {deck.status === "PUBLISHED" ? "Study →" : "…"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
