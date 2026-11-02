import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary:
    "bg-linear-to-b from-[#48bfff] to-[#128af6] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.4),inset_0_-3px_0_rgba(0,60,160,0.35),0_6px_16px_-6px_rgba(30,150,255,0.8)]",
  light:
    "bg-linear-to-b from-white to-[#f1e9da] text-navy-900 shadow-[inset_0_-3px_0_rgba(120,100,60,0.2),0_2px_6px_rgba(0,0,0,0.2)]",
  danger:
    "bg-linear-to-b from-[#ff8b99] to-[#f2566b] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.35),inset_0_-3px_0_rgba(150,20,40,0.3),0_6px_16px_-6px_rgba(255,90,110,0.8)]",
  long: "bg-linear-to-b from-[#62f6be] to-[#2cd396] text-navy-950 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(0,100,60,0.3)]",
  short:
    "bg-linear-to-b from-[#ffa3ad] to-[#f7717f] text-navy-950 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(150,20,40,0.25)]",
  outline: "border-2 border-white/90 bg-transparent text-white",
} as const;

const sizes = {
  sm: "h-9 rounded-[12px] px-4 text-[15px]",
  md: "h-11 rounded-[14px] px-4 text-[17px]",
  lg: "h-12 shrink-0 rounded-[16px] px-5 text-[19px]",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  href?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  href,
  leading,
  trailing,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(
    "inline-flex w-full items-center justify-center gap-2 font-display font-semibold tracking-tight",
    "transition active:translate-y-0.5 active:brightness-95 disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
    sizes[size],
    variant !== "outline" && "gloss",
    variants[variant],
    className,
  );
  const content = (
    <>
      {leading}
      {children}
      {trailing}
    </>
  );

  if (href && !rest.disabled) {
    return (
      <Link href={href} className={classes} onClick={rest.onClick as never}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {content}
    </button>
  );
}
