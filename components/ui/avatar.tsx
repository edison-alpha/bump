import BoringAvatar from "boring-avatars";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const PALETTE = ["#1a9dff", "#7fd3ff", "#ffcb3d", "#ff8b99", "#3fe0a6"];

type AvatarProps = {
  /** Any stable string; the same seed always yields the same face. */
  seed: string;
  size?: number;
  /** Glossy blue ring like the profile pictures in the design. */
  ring?: boolean | "gold" | "silver" | "bronze";
  /** Small round badge on the bottom-right (camera / edit). */
  badge?: ReactNode;
  className?: string;
};

const RING = {
  true: "from-[#9fe0ff] to-[#1a9dff]",
  gold: "from-[#ffe48a] to-[#f0a800]",
  silver: "from-[#e8f4ff] to-[#9cc8ec]",
  bronze: "from-[#ffd0b0] to-[#ee8a52]",
} as const;

export function Avatar({ seed, size = 40, ring = false, badge, className }: AvatarProps) {
  const pad = ring ? Math.max(3, Math.round(size * 0.05)) : 0;
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 rounded-full",
        ring && `bg-linear-to-b ${RING[String(ring) as keyof typeof RING]} shadow-[0_3px_8px_rgba(0,0,0,0.35)]`,
        className,
      )}
      style={{ width: size, height: size, padding: pad }}
    >
      <span className="block size-full overflow-hidden rounded-full bg-[#cfeaff]">
        <BoringAvatar name={seed} size={size - pad * 2} variant="beam" colors={PALETTE} />
      </span>
      {badge && (
        <span className="absolute right-[-2%] bottom-[-2%] grid size-[32%] place-items-center rounded-full bg-white text-navy-900 shadow-md ring-2 ring-navy-900">
          {badge}
        </span>
      )}
    </span>
  );
}
