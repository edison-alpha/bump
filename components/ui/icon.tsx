"use client";

import { addCollection, Icon as Iconify } from "@iconify/react";
import { cn } from "@/lib/cn";
import { LOGOS, SOLAR } from "./icon-data";

/*
 * App icons: Iconify's Solar set (rounded, chunky; linear strokes thickened in fetch-icons.mjs) plus the Google logo.
 * Data is bundled, so nothing is fetched at runtime. To add one: put it in scripts/fetch-icons.mjs, run
 * `pnpm icons:fetch`, then map a semantic name here.
 */
addCollection(SOLAR);
addCollection(LOGOS);

const ICONS = {
  home: "solar:home-2-linear",
  "home-active": "solar:home-2-bold",
  trade: "solar:gamepad-linear",
  "trade-active": "solar:gamepad-bold",
  ranks: "solar:cup-star-linear",
  "ranks-active": "solar:cup-star-bold",
  user: "solar:user-rounded-bold",
  back: "solar:arrow-left-linear",
  next: "solar:arrow-right-linear",
  chevron: "solar:alt-arrow-right-linear",
  "chevron-down": "solar:alt-arrow-down-linear",
  up: "solar:arrow-up-bold",
  "down-right": "solar:arrow-right-down-bold",
  "trend-down": "solar:arrow-right-down-linear",
  mail: "solar:letter-linear",
  search: "solar:magnifier-linear",
  bell: "solar:bell-bold",
  settings: "solar:settings-bold",
  camera: "solar:camera-bold",
  edit: "solar:pen-bold",
  eye: "solar:eye-bold",
  logout: "solar:logout-2-bold",
  history: "solar:clipboard-list-bold",
  book: "solar:book-bold",
  info: "solar:info-circle-bold",
  help: "solar:question-circle-bold",
  minus: "solar:minus-circle-bold",
  target: "solar:target-bold",
  check: "solar:check-bold",
  crown: "solar:crown-bold",
  bars: "solar:chart-2-bold",
  bulb: "solar:lightbulb-bold-duotone",
  trophy: "solar:cup-star-bold",
  google: "logos:google-icon",
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  /** px; defaults to 24. Use className for colour (icons use currentColor). */
  size?: number;
  className?: string;
  label?: string;
};

export function Icon({ name, size = 24, className, label }: IconProps) {
  return (
    <Iconify
      icon={ICONS[name]}
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
