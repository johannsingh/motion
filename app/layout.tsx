import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Motion — Habits, together",
  description:
    "Make room for your goals. A private space to build habits and support each other.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
