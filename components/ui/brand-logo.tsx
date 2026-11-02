import Image from "next/image";
import { cn } from "@/lib/cn";

/** Trimmed navy wordmark (1986 x 702). `light` turns it white for the dark LCD. */
export function BrandLogo({ width = 160, tone = "navy", className }: { width?: number; tone?: "navy" | "light"; className?: string }) {
  return (
    <Image
      src="/brand/wordmark.png"
      alt="bump"
      width={width}
      height={Math.round((width * 702) / 1986)}
      priority
      className={cn(
        "h-auto",
        tone === "navy" ? "drop-shadow-[0_2px_0_rgba(255,255,255,0.45)]" : "brightness-0 invert drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]",
        className,
      )}
    />
  );
}
