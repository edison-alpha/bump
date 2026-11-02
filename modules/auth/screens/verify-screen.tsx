"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { OtpInput } from "@/components/ui/otp-input";
import { maskEmail } from "@/lib/format";
import { useSession } from "@/modules/session/session-provider";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 28;

export function VerifyScreen() {
  const router = useRouter();
  const { session, signIn } = useSession();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const verify = () => {
    if (code.length !== CODE_LENGTH) return;
    signIn();
    router.push(session.username ? "/home" : "/profile-setup");
  };
  usePrimaryAction({ label: "Let me in", onPress: verify, disabled: code.length !== CODE_LENGTH });

  return (
    <Screen title="Check your inbox" back="/sign-in">
      <div className="flex justify-center">
        <Mascot size={124} accessory="mail" sparkles="right" />
      </div>
      <div className="text-center">
        <h2 className="text-pop font-display text-[24px] leading-tight font-bold">Type in your code</h2>
        <p className="mt-0.5 text-[14px] text-white">We sent 6 digits to</p>
        <p className="font-display text-[15px] font-bold">{session.email ? maskEmail(session.email) : "your email"}</p>
      </div>

      <OtpInput value={code} onChange={setCode} length={CODE_LENGTH} />

      <Button size="lg" disabled={code.length !== CODE_LENGTH} onClick={verify} trailing={<Icon name="next" size={26} />}>
        Let me in
      </Button>

      <div className="mt-1 flex items-center gap-4 text-[13px] text-white/85">
        <span className="h-px flex-1 bg-white/25" />
        {seconds > 0 ? (
          <span>New code in {seconds}s</span>
        ) : (
          <button type="button" className="font-semibold text-cyan" onClick={() => setSeconds(RESEND_SECONDS)}>
            Send a new code
          </button>
        )}
        <span className="h-px flex-1 bg-white/25" />
      </div>
      <Link href="/sign-in" className="mx-auto text-[13px] text-white underline underline-offset-4">
        Use a different email
      </Link>
    </Screen>
  );
}
