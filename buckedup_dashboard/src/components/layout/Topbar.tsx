"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TITLES: Record<string, string> = {
  "/overview": "Overview",
  "/library": "Video library",
  "/analytics": "Analytics",
};

function titleForPath(pathname: string | null): string {
  if (!pathname) return "Overview";
  if (pathname.startsWith("/library")) return "Video library";
  const match = Object.keys(TITLES).find((key) => pathname.startsWith(key));
  return match ? TITLES[match] : "Overview";
}

export function Topbar() {
  const pathname = usePathname();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s + 1) % 20), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-[30px] py-[18px]">
      <div className="text-lg font-extrabold text-serpent">
        {titleForPath(pathname)}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-full border border-castleton/20 bg-castleton/[.08] px-[11px] py-[5px] text-[11.5px] font-bold text-castleton">
          Read-only view
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-1">
          <span className="h-[7px] w-[7px] animate-pulse2 rounded-full bg-castleton" />
          Synced {seconds}s ago
        </span>
      </div>
    </div>
  );
}
