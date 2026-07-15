import {
  LayoutGrid,
  Folder,
  FolderOpen,
  Play,
  Video,
  PlayCircle,
  BarChart2,
  Package,
  type LucideProps,
} from "lucide-react";

export function OverviewIcon(props: LucideProps) {
  return <LayoutGrid {...props} />;
}

export function FolderIcon(props: LucideProps) {
  return <Folder {...props} />;
}

export function FolderIconFilled(props: LucideProps) {
  return (
    <FolderOpen className="folder-icon" fill="currentColor" {...props} />
  );
}

export function PlayIcon(props: LucideProps) {
  return <Play {...props} />;
}

export function VideoCameraIcon(props: LucideProps) {
  return <Video {...props} />;
}

export function PlayCircleIcon(props: LucideProps) {
  return <PlayCircle {...props} />;
}

export function AnalyticsIcon(props: LucideProps) {
  return <BarChart2 {...props} />;
}

export function CatalogIcon(props: LucideProps) {
  return <Package {...props} />;
}

export function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6 1.5 6H4.5S6 13.5 6 9Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function UsersIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19c.7-3.2 3.2-5 6.2-5s5.5 1.8 6.2 5" />
      <circle cx="17" cy="7.5" r="2.4" />
      <path d="M15.5 12.2c2.3.2 4.1 1.8 4.7 4.3" />
    </svg>
  );
}
