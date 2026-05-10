import type { Metadata } from "next";
import { InsforgeAuthProvider } from "@/lib/auth-context";
import { Instrument_Serif, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BET — Put your money where your mouth is",
  description:
    "Founders publicly stake money on their goals. An AI agent watches your GitHub and decides if you won. No self-reporting. No honor system.",
  openGraph: {
    title: "BET — Public Founder Accountability",
    description:
      "Stake money on your goals. An AI agent watches your GitHub. No self-reporting.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InsforgeAuthProvider>
      <html
        lang="en"
        className={`${instrumentSerif.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      >
        <body>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  borderRadius: "0",
                  fontFamily: "var(--font-dm-sans)",
                },
              }}
            />
        </body>
      </html>
    </InsforgeAuthProvider>
  );
}
