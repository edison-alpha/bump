import { Button, type ButtonProps } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function GoogleButton({ withChevron = false, className, ...props }: ButtonProps & { withChevron?: boolean }) {
  return (
    <Button
      variant="light"
      className={withChevron ? `px-5 ${className ?? ""}` : className}
      leading={<Icon name="google" size={28} />}
      trailing={withChevron ? <Icon name="chevron" size={24} /> : undefined}
      {...props}
    >
      <span className={withChevron ? "flex-1 text-center" : undefined}>Continue with Google</span>
    </Button>
  );
}
