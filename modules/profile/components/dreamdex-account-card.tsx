"use client";

import { useMutation } from "@tanstack/react-query";
import { useConsole } from "@/components/console/console-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { exchange } from "@/lib/chain/exchange";
import { useSession } from "@/modules/session/session-provider";

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * Trade through the player's own dreamDEX smart account (where their balance and voucher already are) instead of the
 * wallet bump created. The bump wallet has to be one of that account's owners: it then signs and pays gas, and the
 * account is the one that trades. The owner is added in dreamDEX; this card finds the account once that is done.
 */
export function DreamdexAccountCard() {
  const { session, linkTradingAccount } = useSession();
  const { flash } = useConsole();

  const find = useMutation({
    mutationFn: async () => {
      const found = await exchange().client.accounts.listControlledAccounts(session.address as `0x${string}`);
      return found.map((a) => a.address as string);
    },
    onError: () => flash("Couldn't look up your accounts. Try again.", "warn"),
  });
  const link = useMutation({
    mutationFn: (account: string | null) => linkTradingAccount(account),
    onSuccess: (_, account) => {
      find.reset();
      flash(account ? "dreamDEX account connected." : "Back on your bump wallet.", "good");
    },
    onError: (error: Error) => flash(error.message, "warn"),
  });
  const copy = () => navigator.clipboard?.writeText(session.address).then(() => flash("Wallet address copied.", "good")).catch(() => undefined);

  if (session.tradingAccount) {
    return (
      <Card className="flex flex-col gap-1.5 px-3 py-2">
        <p className="text-[14px]">dreamDEX account</p>
        <p className="font-display text-[18px] leading-tight font-bold">{short(session.tradingAccount)}</p>
        <p className="text-[12px] text-white/80">Your trades and balance use this account. Your bump wallet only signs and pays gas.</p>
        <Button size="sm" variant="outline" className="w-auto self-start" disabled={link.isPending} onClick={() => link.mutate(null)}>
          Use my bump wallet instead
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-1.5 px-3 py-2">
      <p className="flex items-center text-[14px]">
        Use your dreamDEX account
        <InfoTip text="Trade with the balance you already have on dreamDEX. Add your bump wallet address as an owner of your Somnia Account, then tap Find my account. dreamDEX's Link a bot doesn't work here: a linked bot can't set TP/SL." />
      </p>
      <p className="text-[12px] text-white/80">Bump wallet: {short(session.address)}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="w-auto" onClick={copy}>
          Copy wallet address
        </Button>
        <Button size="sm" className="w-auto" disabled={find.isPending || link.isPending} onClick={() => find.mutate()}>
          {find.isPending ? "Looking…" : "Find my account"}
        </Button>
      </div>
      {find.data && find.data.length === 0 && <p className="text-[12px] text-white/80">No account lists your bump wallet as an owner yet. Add it in dreamDEX, then try again.</p>}
      {find.data?.map((account) => (
        <Button key={account} size="sm" variant="outline" className="w-auto self-start" disabled={link.isPending} onClick={() => link.mutate(account)}>
          Use {short(account)}
        </Button>
      ))}
    </Card>
  );
}
