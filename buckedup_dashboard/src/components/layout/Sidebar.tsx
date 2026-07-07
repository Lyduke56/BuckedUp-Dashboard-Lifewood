"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/contexts/DashboardContext";
import { doneVideos, totalVideos } from "@/lib/productHelpers";

const NAV_ITEMS = [
  {
    href: "/overview",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/library",
    label: "Video library",
    icon: (
      <svg viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M1 3.5A1.5 1.5 0 012.5 2h5.6a1.5 1.5 0 011.2.6l1.4 1.9h9.3A1.5 1.5 0 0122 6v10.5A1.5 1.5 0 0120.5 18h-18A1.5 1.5 0 011 16.5v-13z" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { products } = useDashboard();
  const published = doneVideos(products);
  const total = totalVideos(products);

  return (
    <aside className="flex w-[220px] flex-shrink-0 flex-col bg-serpent py-[22px] text-paper">
      <div className="mb-2.5 flex items-center gap-2.5 border-b border-white/10 px-5 pb-[18px]">
        <span className="h-[13px] w-[13px] flex-shrink-0 rotate-45 rounded-sm bg-saffron" />
        <div>
          <div className="text-[15.5px] font-bold leading-tight">Lifewood</div>
          <div className="mt-0.5 text-[11px] font-semibold text-earth-yellow">
            × BuckedUp
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-1 flex items-center gap-2.5 rounded-[9px] px-3.5 py-[11px] text-[13.5px] font-semibold transition ${
                active
                  ? "bg-castleton text-white"
                  : "text-green-5 hover:bg-white/[.06] hover:text-paper"
              }`}
            >
              <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 border-t border-white/10 px-5 pt-3.5 text-[11px] leading-relaxed text-green-5">
        <b className="font-extrabold text-saffron">
          {published}/{total}
        </b>{" "}
        videos published
      </div>
    </aside>
  );
}
