import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/design-tokens.css";
import "@/styles/components.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { VersionBadge } from "@/components/ui/VersionBadge";
import { AppShell } from "@/components/ui/AppShell";

export const metadata: Metadata = {
  title: "VBP Navigator OS",
  description:
    "Service management on the ValueBlueprint® method — Service & Value Architecture, tasks, pipeline, budget, and more.",
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <VersionBadge />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
