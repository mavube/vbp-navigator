import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VBP Navigator",
  description:
    "The Service & Value Architecture behind VBP's own operation — built on the ValueBlueprint® method.",
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
