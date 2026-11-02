import { Button, type ButtonProps } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** `short` labels it just "Google", for a half-width button next to another sign-in option. */
export function GoogleButton({
  withChevron = false,
  short = false,
  className,
  ...props
}: ButtonProps & { withChevron?: boolean; short?: boolean }) {
  return (
    <Button
      variant="light"
      className={withChevron ? `px-5 ${className ?? ""}` : className}
      leading={<Icon name="google" size={short ? 22 : 28} />}
      trailing={withChevron ? <Icon name="chevron" size={24} /> : undefined}
      {...props}
    >
      <span className={withChevron ? "flex-1 text-center" : undefined}>{short ? "Google" : "Continue with Google"}</span>
    </Button>
  );
}
