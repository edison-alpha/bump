import Image from "next/image";
import { cn } from "@/lib/cn";
import { CheckBadge, Envelope, Sparkles } from "./decor";
import { Icon } from "./icon";

/** Trimmed artwork ratio (640 x 498). */
const RATIO = 498 / 640;

type MascotProps = {
  /** Rendered width in px. */
  size?: number;
  accessory?: "mail" | "check" | "bulb";
  sparkles?: "left" | "right" | "both";
  bob?: boolean;
  className?: string;
};

export function Mascot({ size = 120, accessory, sparkles, bob = true, className }: MascotProps) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0", bob && "animate-bob", className)}
      style={{ width: size, height: size * RATIO }}
    >
      <Image
        src="/brand/mascot.png"
        alt=""
        width={size}
        height={Math.round(size * RATIO)}
        priority
        className="size-full object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.35)] select-none"
      />
      {(sparkles === "left" || sparkles === "both") && (
        <Sparkles className="absolute top-0 -left-[22%]" />
      )}
      {(sparkles === "right" || sparkles === "both") && (
        <Sparkles className="absolute top-0 -right-[22%] -scale-x-100" />
      )}
      {accessory === "mail" && (
        <Envelope className="absolute right-[-14%] bottom-[8%] rotate-[-12deg] drop-shadow-md" />
      )}
      {accessory === "check" && <CheckBadge className="absolute right-[-10%] bottom-[2%] drop-shadow-md" />}
      {accessory === "bulb" && (
        <Icon name="bulb" size={Math.max(22, size * 0.3)} className="absolute -top-[18%] right-[-8%] rotate-12 text-gold drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]" />
      )}
    </span>
  );
}
