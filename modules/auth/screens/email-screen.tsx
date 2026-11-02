"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useState, type FormEvent } from "react";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { TextField } from "@/components/ui/text-field";
import { useSession } from "@/modules/session/session-provider";
import { GoogleButton } from "../components/google-button";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailScreen() {
  const router = useRouter();
  const { session, setEmail, signIn } = useSession();
  const [value, setValue] = useState(session.email);
  const [touched, setTouched] = useState(false);
  const valid = EMAIL_PATTERN.test(value.trim());

  const send = () => {
    setTouched(true);
    if (!valid) return;
    setEmail(value.trim());
    router.push("/verify");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };
  usePrimaryAction({ label: "Send sign-in code", onPress: send });

  return (
    <Screen title="Welcome back" back="/">
      <form onSubmit={submit} className="flex flex-1 flex-col gap-3" noValidate>
        <div className="flex justify-center">
          <Mascot size={124} accessory="mail" sparkles="left" />
        </div>
        <div className="text-center">
          <h2 className="text-pop font-display text-[26px] leading-tight font-bold">Enter your email</h2>
          <p className="mx-auto mt-0.5 max-w-72 text-[14px] leading-snug text-white">
            We’ll send you a one-time code to sign in to your account.
          </p>
        </div>

        <div>
          <TextField
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            icon={<Icon name="mail" size={26} />}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={touched && !valid}
          />
          {touched && !valid && <p className="mt-1 px-1 text-sm text-coral">Enter a valid email address.</p>}
        </div>

        <Button type="submit" size="lg" trailing={<Icon name="next" size={26} />}>
          Send sign-in code
        </Button>
        <p className="-mt-1 text-center text-[13px] text-white/85">We’ll email you a one-time code.</p>

        <div className="flex items-center gap-4 text-[13px] text-white/80">
          <span className="h-px flex-1 bg-white/25" />
          or
          <span className="h-px flex-1 bg-white/25" />
        </div>

        <GoogleButton
          size="lg"
          onClick={() => {
            signIn();
            router.push("/profile-setup");
          }}
        />
      </form>
    </Screen>
  );
}
