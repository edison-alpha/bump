"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/api/query";
import { disablePush, enablePush, pushEnabled, pushSupported } from "@/lib/push";
import { useConsole } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CoinStack } from "@/components/ui/coin-stack";
import { InfoTip } from "@/components/ui/info-tip";
import { Toggle } from "@/components/ui/toggle";
import { usd } from "@/lib/format";
import { useProgress } from "@/modules/progress/progress-provider";
import { useSession } from "@/modules/session/session-provider";
import { useTrade } from "@/modules/trade/trade-provider";
import { MenuRow } from "../components/menu-row";
import { SkinCard } from "../components/skin-card";
import { WalletBalancesCard } from "../components/wallet-balances-card";

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/** The wallet address in the header corner, with a button to copy it. */
function WalletChip({ address }: { address: string }) {
  const { flash } = useConsole();
  const copy = () => navigator.clipboard?.writeText(address).then(() => flash("Wallet address copied.", "good")).catch(() => flash("Couldn't copy it. Select it instead.", "warn"));
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy wallet address ${address}`}
      className="glass flex h-9 items-center gap-1.5 rounded-full pr-2.5 pl-3 font-display text-[12px] font-semibold tabular-nums"
    >
      {short(address)}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="9" width="11" height="11" rx="2.5" />
        <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
      </svg>
    </button>
  );
}

/** Long dash used for empty stats, as in the design. */
const EMPTY = <span className="mx-auto mt-2 block h-1 w-5 rounded-full bg-white" aria-label="none" />;

export function ProfileScreen() {
  const router = useRouter();
  const { session, setLeaderboardVisibility, signOut, linkTradingAccount } = useSession();
  const [themeOpen, setThemeOpen] = useState(false);
  const { balance, history, broke, refill, refillLabel, mode } = useTrade();
  const { flash } = useConsole();
  const { level, streak, restartTutorial } = useProgress();
  const guest = session.status === "guest";
  const queryClient = useQueryClient();
  const [canPush, setCanPush] = useState(false);
  useEffect(() => setCanPush(pushSupported()), []);
  const push = useQuery({ queryKey: qk.push, queryFn: pushEnabled, enabled: canPush && !guest, staleTime: Infinity });
  const pushToggle = useMutation({
    mutationFn: async (on: boolean) => (on ? enablePush() : disablePush().then(() => false)),
    onMutate: (on) => queryClient.setQueryData(qk.push, on),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.push }),
  });
  const pushOn = push.data ?? false;
  const togglePush = (on: boolean) => pushToggle.mutate(on);

  const wins = history.filter((t) => t.pnl > 0).length;

  return (
    <Screen title="Profile" right={!guest && session.address ? <WalletChip address={session.address} /> : undefined}>
      <div className="flex items-center gap-3">
        <Avatar seed={session.name || "you"} size={80} ring />
        <div className="min-w-0">
          <h2 className="text-pop truncate font-display text-[26px] leading-tight font-bold">{session.name || "Guest"}</h2>
          {!guest && <p className="text-[15px] leading-tight text-white">@{session.username}</p>}
          <Chip tone="info" className="mt-1 rounded-full px-3 text-[14px]">
            Level {level.level} · {guest ? "Guest" : "Practice account"}
          </Chip>
        </div>
      </div>

      <Card className="relative px-3 py-2">
        <p className="flex items-center text-[14px]">
          {mode === "chain" ? "dreamDEX balance" : "Practice balance"}
          <InfoTip text={mode === "chain" ? "Your collateral on dreamDEX testnet. It has no cash value." : "Practice funds have no cash value."} />
        </p>
        <p className="text-pop font-display text-[32px] leading-tight font-bold tabular-nums">{usd(balance)}</p>
        {broke ? (
          <Button size="sm" className="mt-1 w-auto" onClick={() => void refill().catch((error: Error) => flash(error.message, "warn"))}>
            {refillLabel}
          </Button>
        ) : (
          <CoinStack className="absolute top-1/2 right-3 w-[68px] -translate-y-1/2" />
        )}
      </Card>

      {mode === "chain" && <WalletBalancesCard />}

      <Card className="grid grid-cols-3 py-2 text-center">
        <div className="border-r border-white/20">
          <p className="text-[13px]">Trades</p>
          {history.length ? <p className="font-display text-[20px] leading-tight font-bold">{history.length}</p> : EMPTY}
        </div>
        <div className="border-r border-white/20">
          <p className="text-[13px]">Win rate</p>
          {history.length ? <p className="font-display text-[20px] leading-tight font-bold">{Math.round((wins / history.length) * 100)}%</p> : EMPTY}
        </div>
        <div>
          <p className="text-[13px]">Streak</p>
          <p className="font-display text-[20px] leading-tight font-bold">🔥 {streak}</p>
        </div>
      </Card>

      <ul className="flex flex-col gap-1.5">
        {guest && <MenuRow icon="trophy" label="Save my progress (sign in)" href="/sign-in" />}
        {mode === "chain" && <MenuRow icon="bars" label="DEX" href="/bridge" />}
        {mode === "chain" && <MenuRow icon="target" label="Positions" href="/positions" />}
        <MenuRow icon="history" label="Trade history" href="/history" />
      </ul>

      <p className="mt-1 text-[12px] font-semibold tracking-[0.1em] text-white/70 uppercase">Settings</p>
      <ul className="flex flex-col gap-1.5">
        <MenuRow icon="settings" label="Theme" expanded={themeOpen} onClick={() => setThemeOpen((open) => !open)} />
        {themeOpen && (
          <li>
            <SkinCard />
          </li>
        )}
        {!guest && (
          <MenuRow
            icon="eye"
            label="Show me on the leaderboard"
            control={<Toggle checked={session.showOnLeaderboard} onChange={setLeaderboardVisibility} label="Show me on the leaderboard" />}
          />
        )}
        {!guest && canPush && (
          <MenuRow
            icon="bell"
            label="Tell me when a trade closes"
            control={<Toggle checked={pushOn} onChange={togglePush} label="Tell me when a trade closes" />}
          />
        )}
        {session.tradingAccount && (
          <MenuRow
            icon="user"
            label={`dreamDEX account ${short(session.tradingAccount)}`}
            control={
              <button type="button" className="shrink-0 text-[13px] font-semibold text-cyan" onClick={() => void linkTradingAccount(null).then(() => flash("Back on your bump wallet.", "good")).catch((error: Error) => flash(error.message, "warn"))}>
                Use my wallet
              </button>
            }
          />
        )}
        <MenuRow
          icon="book"
          label="Replay the guided trade"
          onClick={() => {
            restartTutorial();
            router.push("/markets");
          }}
        />
        <MenuRow
          icon="logout"
          label={guest ? "Leave guest mode" : "Sign out"}
          danger
          onClick={async () => {
            if (pushOn) await disablePush();
            await signOut();
            router.replace("/");
          }}
        />
      </ul>

      <p className="mt-auto text-center text-[11px] text-white">Practice funds have no cash value.</p>
    </Screen>
  );
}
