import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Raleway } from "next/font/google";
import { Providers } from "@/components/app/providers";
import "./globals.css";

const heading = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-heading",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

/** Server-loaded so the intro never paints in a fallback face. */
const raleway = Raleway({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-raleway",
  display: "block",
  preload: true,
});

export const metadata: Metadata = {
  title: "TrustVault | Secure document sharing",
  description:
    "Share confidential documents with named people, revoke access instantly, and review every attempt — including refusals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${body.variable} ${mono.variable} ${raleway.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-black font-sans text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
