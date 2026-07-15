import Link from "next/link";
import Logo from "@/components/Logo";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-950 via-brand-900 to-accent-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <span className="text-lg font-semibold tracking-tight">BMU AI Tutor</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-2 text-white/80 hover:text-white">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-brand-500 px-4 py-2 font-medium text-white hover:bg-brand-400"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center">
        <span className="inline-block rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs font-medium uppercase tracking-wide text-brand-200">
          Bayelsa Medical University
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
          Your AI learning companion, built for medical students.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-white/70">
          Chat with your lecture notes, generate quizzes from any document, and test your
          understanding with instant auto-grading. Now with cited answers, flashcards, spaced
          repetition, and smart study insights — all powered by a private, on-campus AI.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-accent-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-accent-500/30 hover:bg-accent-500"
          >
            Create your account
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-white/20 px-6 py-3 text-base font-medium text-white hover:bg-white/10"
          >
            I already have an account
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Chat with your notes",
            body: "Upload PDFs, Word docs or text and ask questions. Answers are grounded in your own material.",
          },
          {
            title: "Cited answers",
            body: "Every reply shows the exact note excerpts it was based on, so you can verify the source.",
          },
          {
            title: "Confidence you can see",
            body: "Each answer is tagged confident, fairly sure, or uncertain — so you know when to double-check.",
          },
          {
            title: "Snap a photo",
            body: "Send a whiteboard or diagram and the tutor reads the image and explains it back to you.",
          },
          {
            title: "Generate quizzes",
            body: "Turn any uploaded document or topic into a multiple-choice quiz with one correct answer.",
          },
          {
            title: "Instant grading",
            body: "Submit your answers and get an immediate score, plus explanations for every question.",
          },
          {
            title: "Flashcards & review",
            body: "Turn notes into flashcards and drill your mistakes with spaced repetition that adapts to you.",
          },
          {
            title: "Smart study insights",
            body: "See your accuracy, weakest topics, and a focus suggestion drawn from past quiz attempts.",
          },
          {
            title: "Notices & assignments",
            body: "Admins post announcements and assign quizzes to your cohort by faculty, department and level.",
          },
          {
            title: "Ask a human",
            body: "Stuck? Send a question to a lecturer and get their reply right inside the app.",
          },
          {
            title: "Voice in, voice out",
            body: "Speak your questions with speech-to-text and listen to responses with text-to-speech.",
          },
          {
            title: "Private, fast & offline-ready",
            body: "Runs on a local Ollama model on the university VPS — no data leaves campus, and it works offline.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
          >
            <h3 className="text-lg font-semibold text-white">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/70">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-white/50">
          © {new Date().getFullYear()} BMU AI Tutor · Bayelsa Medical University
      </footer>
    </main>
  );
}
