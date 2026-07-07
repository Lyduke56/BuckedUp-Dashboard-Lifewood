import Link from "next/link";

export function CtaCards() {
  return (
    <div>
      <Link
        href="/library"
        className="mb-3 block rounded-xl border border-line bg-paper p-[15px_17px] transition hover:border-castleton hover:bg-[#efe6cd]"
      >
        <div className="text-[13.5px] font-extrabold">
          Browse the video library →
        </div>
        <div className="mt-[3px] text-[11.5px] font-semibold text-ink-soft">
          Filter by category, subcategory, or status
        </div>
      </Link>
      <Link
        href="/analytics"
        className="block rounded-xl border border-line bg-paper p-[15px_17px] transition hover:border-castleton hover:bg-[#efe6cd]"
      >
        <div className="text-[13.5px] font-extrabold">Open analytics →</div>
        <div className="mt-[3px] text-[11.5px] font-semibold text-ink-soft">
          Status distribution and category completion
        </div>
      </Link>
    </div>
  );
}
