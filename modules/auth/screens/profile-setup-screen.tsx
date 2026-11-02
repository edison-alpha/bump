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
import { useSession } from "@/modules/session/session-provider";

const toUsername = (name: string) => name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);

export function ProfileSetupScreen() {
  const router = useRouter();
  const { session, saveProfile } = useSession();
  const [name, setName] = useState(session.name);
  const [username, setUsername] = useState(session.username);
  const [edited, setEdited] = useState(!!session.username);
  const [visible, setVisible] = useState(session.showOnLeaderboard);

  const canSubmit = name.trim().length > 0 && username.length > 0;
  const save = () => {
    if (!canSubmit) return;
    saveProfile({ name: name.trim(), username, showOnLeaderboard: visible });
    router.push("/home");
  };
  usePrimaryAction({ label: "Let’s go", onPress: save, disabled: !canSubmit });

  return (
    <Screen title="Make it yours." back>
      <form
        className="flex flex-1 flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="relative mx-auto">
          <Sparkles className="absolute top-1 -left-10" />
          <Avatar seed={name || "you"} size={92} ring badge={<Icon name="camera" size={18} />} />
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

        <Button type="submit" size="lg" className="mt-auto" disabled={!canSubmit} trailing={<Icon name="next" size={26} />}>
          Let’s go
        </Button>
      </form>
    </Screen>
  );
}
