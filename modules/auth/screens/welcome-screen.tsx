"use client";

import { useRouter } from "next/navigation";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { Clouds, Sparkles, Star, TrendArrow } from "@/components/ui/decor";
import { Icon } from "@/components/ui/icon";
import { Mascot } from "@/components/ui/mascot";
import { SpeechBubble } from "@/components/ui/speech-bubble";
import { useSession } from "@/modules/session/session-provider";
import { GoogleButton } from "../components/google-button";
import { useRedirectIfSignedIn } from "../use-redirect-if-signed-in";

export function WelcomeScreen() {
  const router = useRouter();
  const { signInWithGoogle, continueAsGuest } = useSession();
  useRedirectIfSignedIn();
  // straight into the guided first trade; an account is offered once there's a score worth saving
  const play = () => {
    continueAsGuest();
    router.push("/markets");
  };
  usePrimaryAction({ label: "Play now", onPress: play });

  return (
    <Screen
      className="overflow-x-hidden px-3.5 pt-4"
      header={
        <header className="flex shrink-0 justify-center">
          <BrandLogo width={124} tone="light" />
        </header>
      }
    >
      <h1 className="text-pop text-center font-display text-[32px] leading-[1.02] font-bold">Up or down? Make the call.</h1>
      <p className="-mt-0.5 text-center text-[15px] text-white">Practice trading with play money. Only your pride is at stake.</p>

      <div className="relative -mx-3.5 flex min-h-40 flex-1 items-end justify-center">
        <Clouds tone="mixed" className="absolute inset-x-0 bottom-0 h-16" />
        <Sparkles className="absolute top-[18%] left-[10%]" />
        <Star className="absolute top-[52%] right-[24%]" />
        <TrendArrow className="absolute top-[38%] right-[8%]" />
        <SpeechBubble tail="bottom-left" className="absolute top-[4%] right-[6%] w-24 text-center text-[13px]">
          Ready to play?
        </SpeechBubble>
        <Mascot size={170} className="relative mb-3" />
      </div>

      <div className="flex flex-col gap-2">
        <Button size="lg" className="h-14 text-[22px]" onClick={play} trailing={<Icon name="next" size={26} />}>
          Play now
        </Button>
        <p className="-mt-0.5 text-center text-[12px] text-white/85">No sign-up. Your first trade takes 30 seconds.</p>
        <div className="flex items-center gap-3 text-[12px] text-white/75">
          <span className="h-px flex-1 bg-white/25" />
          Have an account?
          <span className="h-px flex-1 bg-white/25" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <GoogleButton short size="md" onClick={() => void signInWithGoogle()} />
          <Button variant="outline" size="md" href="/sign-in" leading={<Icon name="mail" size={22} />}>
            Email
          </Button>
        </div>
      </div>
    </Screen>
  );
}
