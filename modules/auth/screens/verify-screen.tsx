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
  const { session, ready, authError, verifyEmailCode, sendEmailCode } = useSession();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  // the code is accepted, the wallet is made and the backend knows the player: move on
  useEffect(() => {
    if (ready && session.status === "member") router.replace(session.username ? "/home" : "/profile-setup");
  }, [ready, session.status, session.username, router]);

  const verify = async () => {
    if (code.length !== CODE_LENGTH || checking) return;
    setChecking(true);
    setError(null);
    try {
      await verifyEmailCode(code);
    } catch (e) {
      setError((e as Error).message);
      setChecking(false);
    }
  };
  const resend = async () => {
    setSeconds(RESEND_SECONDS);
    setError(null);
    try {
      await sendEmailCode(session.email);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const busy = checking && !error && !authError;
  usePrimaryAction({ label: busy ? "Charging up…" : "Let me in", onPress: () => void verify(), disabled: code.length !== CODE_LENGTH || busy });

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
      {(error ?? authError) && (
        <p role="alert" className="-mt-1 text-center text-sm text-coral">
          {error ?? authError}
        </p>
      )}

      <Button size="lg" disabled={code.length !== CODE_LENGTH || busy} onClick={() => void verify()} trailing={<Icon name="next" size={26} />}>
        {busy ? "Charging up…" : "Let me in"}
      </Button>

      <div className="mt-1 flex items-center gap-4 text-[13px] text-white/85">
        <span className="h-px flex-1 bg-white/25" />
        {seconds > 0 ? (
          <span>New code in {seconds}s</span>
        ) : (
          <button type="button" className="font-semibold text-cyan" onClick={() => void resend()}>
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
