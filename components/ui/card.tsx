import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Glassy surface inside the dark screen. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-[16px]", className)} {...rest} />;
}

/** Cream promo / tip card. */
export function LightCard({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[18px] bg-linear-to-b from-white to-[#f1e9da] text-navy-900 shadow-[inset_0_-3px_0_rgba(120,100,60,0.18),0_4px_10px_rgba(0,0,0,0.3)]",
        className,
      )}
      {...rest}
    />
  );
}
