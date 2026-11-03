"use client";

import { addCollection, Icon as Iconify } from "@iconify/react";
import { cn } from "@/lib/cn";
import { TOKEN_BRANDED } from "./icon-data";

/* Coin logos from Iconify's Web3 Icons Branded set, bundled locally. To add one: put it in scripts/fetch-icons.mjs. */
addCollection(TOKEN_BRANDED);

const LOGOS: Record<string, string> = Object.fromEntries(
  ["btc", "eth", "sol", "bnb", "xrp", "ada", "avax", "doge", "link", "sui", "xlm", "near", "zec"].map((s) => [s.toUpperCase(), `token-branded:${s}`]),
);
LOGOS["1000PEPE"] = "token-branded:pepe";

// Sources are recorded in public/tokens/SOURCES.md; LIT and TAO collide with other projects in the icon set.
const TOKEN_IMAGES: Record<string, string> = {
  HYPE: "/tokens/hype.png",
  WLD: "/tokens/wld.png",
  ZRO: "/tokens/zro.png",
  PUMP: "/tokens/pump.png",
  VVV: "/tokens/vvv.svg",
  LIT: "/tokens/lit.png",
  TAO: "/tokens/tao.ico",
};

type CoinIconProps = { symbol: string; size?: number; className?: string };

export function CoinIcon({ symbol, size = 40, className }: CoinIconProps) {
  const key = symbol.trim().toUpperCase();
  const logo = LOGOS[key];
  const image = TOKEN_IMAGES[key];

  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "shadow-[0_3px_6px_rgba(0,0,0,0.35)]",
        !logo && !image && "bg-navy-600",
        ["WLD", "TAO", "XLM", "XRP"].includes(key) && "bg-white",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {image ? (
        <img src={image} alt="" width={size} height={size} className="size-full object-contain" />
      ) : logo ? (
        <Iconify icon={logo} width={size} height={size} aria-hidden />
      ) : (
        <span className="font-display font-bold text-white">{key.slice(0, 1)}</span>
      )}
    </span>
  );
}
