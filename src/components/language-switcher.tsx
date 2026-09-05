"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Indian languages only, per the org's actual learner base — matches the same scope
// they already curated for the BookStack side (a script in BookStack's settings).
// Add/remove entries here if that list changes; codes are Google Translate's own.
const LANGUAGES = [
  { code: "hi", label: "हिन्दी", englishLabel: "Hindi" },
  { code: "bn", label: "বাংলা", englishLabel: "Bengali" },
  { code: "te", label: "తెలుగు", englishLabel: "Telugu" },
  { code: "mr", label: "मराठी", englishLabel: "Marathi" },
  { code: "ta", label: "தமிழ்", englishLabel: "Tamil" },
  { code: "ur", label: "اردو", englishLabel: "Urdu" },
  { code: "gu", label: "ગુજરાતી", englishLabel: "Gujarati" },
  { code: "kn", label: "ಕನ್ನಡ", englishLabel: "Kannada" },
  { code: "or", label: "ଓଡ଼ିଆ", englishLabel: "Odia" },
  { code: "ml", label: "മലയാളം", englishLabel: "Malayalam" },
  { code: "pa", label: "ਪੰਜਾਬੀ", englishLabel: "Punjabi" },
  { code: "as", label: "অসমীয়া", englishLabel: "Assamese" },
] as const;

function readCookieLanguage(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([a-zA-Z-]+)/);
  return match ? match[1] : null;
}

// The widget itself (not just our own script) writes a `googtrans` cookie once a
// translation is live, and it does so scoped to the bare registrable domain (e.g.
// ".humansofwelive.org"), not just the exact hostname we run on ("lms.humansofwelive.org").
// Clearing only the exact-hostname cookie left that wider-scoped one behind, so picking
// "English" again reloaded straight back into the still-cookied language. Setting/
// clearing all three scopes — host-only, exact hostname, and the registrable root —
// keeps every variant in sync regardless of which one actually holds the value.
function cookieDomains(host: string): (string | null)[] {
  const parts = host.split(".");
  const root = parts.length > 2 ? parts.slice(-2).join(".") : host;
  return Array.from(new Set<string | null>([null, host, root]));
}

function setTranslateCookie(code: string | null) {
  const host = window.location.hostname;
  for (const domain of cookieDomains(host)) {
    const domainAttr = domain ? `;domain=.${domain}` : "";
    document.cookie = code
      ? `googtrans=/en/${code};path=/${domainAttr}`
      : `googtrans=;path=/${domainAttr};expires=Thu, 01 Jan 1970 00:00:00 UTC`;
  }
}

export function LanguageSwitcher({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // document.cookie doesn't exist during SSR, so this can't be a lazy useState
    // initializer — that would run on the server too and mismatch what the client
    // then hydrates with. Rendering the SSR-safe default ("Translate") first and
    // picking up the real cookie value post-mount is the correct fix, not a smell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(readCookieLanguage());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(code: string | null) {
    // The actual translation control (the underlying <select>) lives inside a
    // cross-origin translate.google.com iframe, not reachable from our own script —
    // Google's widget instead watches this cookie and applies the translation itself
    // on load. A reload is the reliable way to trigger that; a same-tab DOM poke
    // doesn't work with the current widget implementation.
    setTranslateCookie(code);
    window.location.reload();
  }

  const activeLanguage = LANGUAGES.find((l) => l.code === active);
  const triggerLabel = activeLanguage ? activeLanguage.label : "Translate";

  return (
    <div ref={ref} className={cn("relative", variant === "mobile" && "w-full")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Choose a language to translate this page"
        className={cn(
          "flex items-center gap-1.5 rounded-control text-[13px] font-medium text-ink/80 transition-colors hover:text-ink",
          variant === "desktop" ? "px-1" : "w-full justify-between rounded-control border border-grey-200 px-3 py-2"
        )}
      >
        <span className="flex items-center gap-1.5">
          <Languages className="size-4" />
          {triggerLabel}
        </span>
      </button>

      {open ? (
        <div
          className={cn(
            "z-30 max-h-72 overflow-y-auto rounded-card border border-grey-200 bg-white p-1.5 shadow-lg",
            variant === "desktop" ? "absolute right-0 top-full mt-2 w-48" : "relative mt-1.5 w-full"
          )}
        >
          <button
            type="button"
            onClick={() => choose(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-control px-2.5 py-1.5 text-left text-sm hover:bg-grey-100",
              !active ? "font-semibold text-ink" : "text-grey-700"
            )}
          >
            English
            {!active ? <Check className="size-3.5 text-accent" /> : null}
          </button>
          <div className="my-1 border-t border-grey-100" />
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => choose(lang.code)}
              className={cn(
                "flex w-full items-center justify-between rounded-control px-2.5 py-1.5 text-left text-sm hover:bg-grey-100",
                active === lang.code ? "font-semibold text-ink" : "text-grey-700"
              )}
            >
              <span>
                {lang.label} <span className="text-grey-400">· {lang.englishLabel}</span>
              </span>
              {active === lang.code ? <Check className="size-3.5 shrink-0 text-accent" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
