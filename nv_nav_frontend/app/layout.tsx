import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/navigation/Sidebar";

export const metadata: Metadata = {
  title: "NV-Nav | Calibration-Free NV Magnetometry & Map-Matching Navigation",
  description:
    "Research dashboard for calibration-free NV-center vector magnetometry fused with magnetic map-matching navigation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <Providers>
          <div className="flex min-h-screen w-full">
            <Sidebar />
            <main className="flex-1 min-w-0">
              <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8 animate-fade-in">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
