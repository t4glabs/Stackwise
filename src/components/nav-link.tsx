"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "border-b-2 pb-0.5 text-[15px] leading-6 transition-colors",
        active
          ? "border-ink font-semibold text-ink"
          : "border-transparent font-normal text-ink/80 hover:text-ink",
        className
      )}
    >
      {children}
    </Link>
  );
}
