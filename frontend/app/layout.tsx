import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://carplan.tech"),
  title: { default: "CarPlan: your car's next move", template: "%s | CarPlan" },
  description: "Snap your lease or loan contract. See every option side by side, with honest math and the Toyota Financial Services products that fit.",
  openGraph: { siteName: "CarPlan", url: "https://carplan.tech", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-20 border-b border-tline bg-white">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-xl font-bold tracking-tight">
                Car<span className="text-tred">Plan</span>
              </span>
              <span className="hidden text-xs text-tgray sm:inline">for Toyota Financial Services</span>
            </Link>
            <a href="https://www.toyotafinancial.com/us/en.html" className="text-sm text-tgray hover:text-black">
              toyotafinancial.com
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-24">{children}</main>
      </body>
    </html>
  );
}
