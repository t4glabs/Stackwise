"use client";

import Script from "next/script";

// Mounted once in the root layout — Google's Website Translator widget, driven
// entirely through our own LanguageSwitcher UI in the header rather than its default
// (famously ugly, hard-to-restyle) dropdown. This div stays in the DOM but off-screen.
// Initializing this is what makes Google's script watch the `googtrans` cookie and
// auto-translate on load — LanguageSwitcher sets that cookie and reloads rather than
// reaching into this widget directly (its actual <select> lives inside a cross-origin
// translate.google.com iframe as of the current widget version, not reachable from
// our script — see the note on LanguageSwitcher in DESIGN_SYSTEM.md). See globals.css
// for the overrides that suppress Google's own banner/tooltip chrome.
export function GoogleTranslateLoader() {
  return (
    <>
      <div
        id="google_translate_element"
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] -top-[9999px] size-px overflow-hidden"
      />
      <Script id="google-translate-init" strategy="afterInteractive">
        {`
          function googleTranslateElementInit() {
            new google.translate.TranslateElement(
              {
                pageLanguage: "en",
                includedLanguages: "hi,bn,te,mr,ta,ur,gu,kn,or,ml,pa,as",
                layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
                autoDisplay: false,
              },
              "google_translate_element"
            );
          }
        `}
      </Script>
      <Script
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
    </>
  );
}
