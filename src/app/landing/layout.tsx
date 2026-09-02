import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ultron AI — Autonomous Penetration Testing Platform",
  description:
    "The mind of a hacker, the speed of a machine. Ultron is an AI-driven offensive security system that autonomously discovers, validates, and exploits vulnerabilities.",
  keywords: [
    "penetration testing",
    "AI security",
    "autonomous hacking",
    "vulnerability scanner",
    "bug bounty",
    "offensive security",
    "red team AI",
  ],
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
