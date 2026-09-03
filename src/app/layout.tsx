import type { Metadata } from "next";
import { Figtree, Source_Serif_4, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GoogleTranslateLoader } from "@/components/google-translate-loader";
import { getPrimaryOrganization } from "@/lib/org";
import { isValidHexColor } from "@/lib/color";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const org = await getPrimaryOrganization();
  return {
    title: org.brandName,
    description: `Courses and transition programs for ${org.name} learners.`,
    // Falls back to the static app/favicon.ico convention when no favicon has been
    // uploaded in /admin/settings.
    icons: org.faviconUrl ? { icon: org.faviconUrl } : undefined,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const org = await getPrimaryOrganization();
  const accentColor = isValidHexColor(org.accentColor) ? org.accentColor : "#7358b3";

  return (
    <html
      lang="en"
      className={`${figtree.variable} ${sourceSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Every NGO deployment sets its own accent color from /admin/settings — this is
          the one place that value turns into an actual CSS override, so every
          `accent`/`accent-soft` utility in the app follows it automatically. */}
      <head>
        <style>{`:root { --color-accent: ${accentColor}; }`}</style>
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <GoogleTranslateLoader />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
