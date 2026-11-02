import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: ReactNode;
};

export function TextField({ label, icon, id, className, ...rest }: TextFieldProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1 block font-display text-[15px] font-semibold text-white">
          {label}
        </label>
      )}
      <div className="recess flex h-12 items-center gap-3 rounded-[14px] px-4 focus-within:border-cyan">
        {icon && <span className="text-white/85">{icon}</span>}
        <input
          id={inputId}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-white/55",
            className,
          )}
          {...rest}
        />
      </div>
    </div>
  );
}
