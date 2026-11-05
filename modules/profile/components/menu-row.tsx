import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/icon";

type MenuRowProps = {
  icon: IconName;
  label: string;
  href?: string;
  onClick?: () => void;
  /** Replaces the chevron, e.g. a toggle. The row itself is then not clickable. */
  control?: ReactNode;
  /** Red icon, no chevron (sign out). */
  danger?: boolean;
  /** For a row that opens something below it: the chevron points down while it is open. */
  expanded?: boolean;
};

export function MenuRow({ icon, label, href, onClick, control, danger, expanded }: MenuRowProps) {
  const body = (
    <>
      <Icon name={icon} size={24} className={danger ? "text-coral" : "text-white"} />
      <span className="flex-1 text-left text-[15px] font-semibold">{label}</span>
      {control ?? (!danger && <Icon name="chevron" size={20} className={cn("text-white transition-transform", expanded && "rotate-90")} />)}
    </>
  );
  const row = "glass flex min-h-10 w-full items-center gap-3 rounded-[12px] px-3";

  return (
    <li>
      {control ? (
        <div className={row}>{body}</div>
      ) : href ? (
        <Link href={href} className={row}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-expanded={expanded} className={cn(row)}>
          {body}
        </button>
      )}
    </li>
  );
}
