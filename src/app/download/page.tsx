import type { Metadata } from "next";
import { DownloadPageContent } from "./DownloadPageContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Download | Ultron-AI",
  description:
    "Download Ultron-AI for macOS, Windows, Linux, iOS, and Android. AI-powered penetration testing at your fingertips.",
  openGraph: {
    title: "Download Ultron-AI",
    description:
      "Download Ultron-AI for macOS, Windows, Linux, iOS, and Android. AI-powered penetration testing at your fingertips.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Download Ultron-AI",
    description:
      "Download Ultron-AI for macOS, Windows, Linux, iOS, and Android. AI-powered penetration testing at your fingertips.",
  },
};

export default function DownloadPage() {
  return <DownloadPageContent />;
}
