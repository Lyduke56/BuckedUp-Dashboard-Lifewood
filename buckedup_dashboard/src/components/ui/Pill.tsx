interface PillProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function Pill({ label, active, onClick }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-[11.5px] font-bold transition ${
        active
          ? "border-castleton bg-castleton text-white"
          : "border-line bg-white text-ink-soft hover:border-castleton"
      }`}
    >
      {label}
    </button>
  );
}
