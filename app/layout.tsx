import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import type { ReactNode } from "react";
import { PhoneFrame } from "@/components/shell/phone-frame";
import { RegisterServiceWorker } from "@/components/shell/register-sw";
import { StandaloneViewport } from "@/components/shell/standalone-viewport";
import { SKIN_BOOT_SCRIPT } from "@/lib/skins";
import { Providers } from "./providers";
import "./globals.css";

const display = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const sans = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: { default: "bump", template: "%s · bump" },
  description: "Up or down? Practice trading crypto with play money on a pocket-sized console.",
  applicationName: "bump",
  appleWebApp: { capable: true, title: "bump", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // matches the top of the bezel so the status bar blends into the console
  themeColor: "#86d9ff",
  width: "device-width",
  initialScale: 1,
  // it's a handheld console, not a page: no pinch zoom
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKIN_BOOT_SCRIPT }} />
      </head>
      <body>
        <StandaloneViewport />
        <Providers>
          <PhoneFrame>{children}</PhoneFrame>
        </Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
