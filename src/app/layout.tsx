import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BMU AI Tutor",
  description:
    "The AI learning companion for Bayelsa Medical University students — chat with your lecture notes, generate and take quizzes, all powered by local AI.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
