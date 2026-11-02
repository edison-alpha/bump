import { cn } from "@/lib/cn";

/** "Powered by dreamDEX" footer. `light` sits on the dark panel, `dark` on the blue frame. */
export function PoweredBy({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <p className={cn("text-center text-xs", tone === "light" ? "text-white/80" : "text-navy-800", className)}>
      Powered by <span className="font-display font-bold">dreamDEX</span>
    </p>
  );
}
