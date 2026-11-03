"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useState } from "react";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sparkles } from "@/components/ui/decor";
import { TextField } from "@/components/ui/text-field";
import { Toggle } from "@/components/ui/toggle";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/modules/session/session-provider";

const toUsername = (name: string) => name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);

export function ProfileSetupScreen() {
  const router = useRouter();
  const { session, saveProfile } = useSession();
  // a guest signing up starts from a blank name, not "Guest"
  const [name, setName] = useState(session.status === "guest" || session.name === "Guest" ? "" : session.name);
  const [username, setUsername] = useState(session.username);
  const [edited, setEdited] = useState(!!session.username);
  const [visible, setVisible] = useState(session.showOnLeaderboard);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && username.length >= 3 && !saving;
  const save = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ name: name.trim(), username, showOnLeaderboard: visible });
      router.push("/home");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? "That username is taken. Try another." : (e as Error).message);
      setSaving(false);
    }
  };
  /** Playing matters more than a name: fall back to the email's first part, hidden from the leaderboard. */
  const skip = async () => {
    const fallback = session.email.split("@")[0] || "player";
    const base = (toUsername(fallback) || "player").padEnd(3, "0").slice(0, 15);
    setSaving(true);
    // a taken name gets a few random digits; three tries is plenty
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await saveProfile({ name: fallback, username: attempt ? `${base}${Math.floor(1000 + Math.random() * 9000)}` : base, showOnLeaderboard: false });
        router.push("/home");
        return;
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 409)) {
          setError((e as Error).message);
          break;
        }
      }
    }
    setSaving(false);
  };
  usePrimaryAction({ label: saving ? "Saving…" : "Let’s go", onPress: () => void save(), disabled: !canSubmit });

  return (
    <Screen title="Make it yours." back>
      <form
        className="flex flex-1 flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="relative mx-auto">
          <Sparkles className="absolute top-1 -left-10" />
          <Avatar seed={name || "you"} size={92} ring />
        </div>
        <p className="text-center text-[14px] leading-snug text-white">
          Pick a name. It’s how other players spot you on the leaderboard.
        </p>

        <TextField
          label="Display name"
          name="name"
          autoComplete="nickname"
          maxLength={24}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!edited) setUsername(toUsername(e.target.value));
          }}
        />
        <TextField
          label="Username"
          name="username"
          autoCapitalize="none"
          autoCorrect="off"
          value={username ? `@${username}` : ""}
          placeholder="@username"
          onChange={(e) => {
            setEdited(true);
            setUsername(toUsername(e.target.value));
          }}
        />

        <div className="recess flex items-center gap-3 rounded-[14px] px-3.5 py-2">
          <Icon name="trophy" size={26} className="text-gold drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]" />
          <span className="flex-1 font-display text-[14px] leading-tight font-semibold">
            Show me on
            <br />
            the leaderboard
          </span>
          <Toggle checked={visible} onChange={setVisible} label="Show me on the leaderboard" />
        </div>
        <p className="-mt-1 text-center text-[13px] text-white/85">You can switch this off anytime in Profile.</p>
        {error && (
          <p role="alert" className="text-center text-sm text-coral">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-auto" disabled={!canSubmit} trailing={<Icon name="next" size={26} />}>
          {saving ? "Saving…" : "Let’s go"}
        </Button>
        <button type="button" onClick={() => void skip()} disabled={saving} className="-mt-1 text-center text-[13px] text-white/85 underline underline-offset-4">
          Skip for now
        </button>
      </form>
    </Screen>
  );
}
