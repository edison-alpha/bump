"use client";

import { addCollection, Icon as Iconify } from "@iconify/react";
import { cn } from "@/lib/cn";
import { TOKEN_BRANDED } from "./icon-data";

/* Coin logos from Iconify's Web3 Icons Branded set, bundled locally. To add one: put it in scripts/fetch-icons.mjs. */
addCollection(TOKEN_BRANDED);

const LOGOS: Record<string, string> = {
  BTC: "token-branded:btc",
  ETH: "token-branded:eth",
  SOL: "token-branded:sol",
  BNB: "token-branded:bnb",
  XRP: "token-branded:xrp",
};

type CoinIconProps = { symbol: string; size?: number; className?: string };

/** Glossy 3D crypto coin. */
export function CoinIcon({ symbol, size = 40, className }: CoinIconProps) {
  const logo = LOGOS[symbol];

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "shadow-[0_3px_6px_rgba(0,0,0,0.35)]",
        !logo && "bg-navy-600",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {logo ? (
        <Iconify icon={logo} width={size} height={size} aria-hidden />
      ) : (
        <span className="font-display font-bold text-white">{symbol.slice(0, 1)}</span>
      )}
      {/* gloss + rim shading over the flat logo */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_-3px_4px_rgba(0,0,0,0.25),inset_0_2px_2px_rgba(255,255,255,0.45)]"
      />
      <span aria-hidden className="pointer-events-none absolute inset-x-[18%] top-[6%] h-[32%] rounded-full bg-linear-to-b from-white/40 to-white/0" />
    </span>
  );
}
