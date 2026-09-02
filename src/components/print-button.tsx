"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

// Browser print-to-PDF covers "download" without needing a PDF-generation dependency —
// the page's own print styles (see .no-print in globals.css) strip the site chrome.
export function PrintButton() {
  return (
    <Button variant="accent" onClick={() => window.print()} className="no-print">
      <Printer className="size-4" /> Print or save as PDF
    </Button>
  );
}
