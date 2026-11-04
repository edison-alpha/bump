"use client";

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useConsole } from "@/components/console/console-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { exchange } from "@/lib/chain/exchange";
import { useDreamdexConnect, type DreamdexAccount } from "@/modules/profile/use-dreamdex-connect";
import { useSession } from "@/modules/session/session-provider";

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * Trade through the player's own dreamDEX smart account (where their balance and voucher already are) instead of the
 * wallet bump created. The player connects the wallet they use on dreamDEX, picks the account, and approves once: that
 * wallet adds the bump wallet as an owner, which then signs and pays gas while the account is the one that trades.
 */
export function DreamdexAccountCard() {
  const { session, linkTradingAccount } = useSession();
  const { flash } = useConsole();
  const { external, connectWallet, lookup, connect, reason } = useDreamdexConnect();
  const { mutate: findAccounts, reset: resetLookup } = lookup;

  // the wallet is connected: list the accounts it controls
  useEffect(() => {
    if (external && !session.tradingAccount) findAccounts();
    else resetLookup();
  }, [external?.address, session.tradingAccount, findAccounts, resetLookup, external]);

  // fallback for players who already added the bump wallet as an owner inside dreamDEX
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
  const pick = (account: DreamdexAccount) =>
    connect.mutate(account, {
      onSuccess: () => flash("dreamDEX account connected.", "good"),
      onError: (error) => flash(error instanceof Error && /^(That|Your|Connect|The)/.test(error.message) ? error.message : reason(error), "warn"),
    });
  const copy = () => navigator.clipboard?.writeText(session.address).then(() => flash("Wallet address copied.", "good")).catch(() => undefined);
  const busy = connect.isPending || link.isPending;

  if (session.tradingAccount) {
    return (
      <Card className="flex flex-col gap-1.5 px-3 py-2">
        <p className="text-[14px]">dreamDEX account</p>
        <p className="font-display text-[18px] leading-tight font-bold">{short(session.tradingAccount)}</p>
        <p className="text-[12px] text-white/80">Your trades and balance use this account. Your bump wallet only signs and pays gas.</p>
        <Button size="sm" variant="outline" className="w-auto self-start" disabled={busy} onClick={() => link.mutate(null)}>
          Use my bump wallet instead
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-1.5 px-3 py-2">
      <p className="flex items-center text-[14px]">
        Use your dreamDEX account
        <InfoTip text="Trade with the balance and voucher you already have on dreamDEX. Connect the wallet you use there and approve once: it adds your bump wallet as an owner so trades need no prompts. dreamDEX's Link a bot doesn't work here: a linked bot can't set TP/SL." />
      </p>

      {!external && (
        <>
          <p className="text-[12px] text-white/80">Connect the wallet you use on dreamDEX. You approve once; after that bump trades without asking.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="w-auto" onClick={connectWallet}>
              Connect dreamDEX wallet
            </Button>
            <Button size="sm" variant="outline" className="w-auto" disabled={find.isPending || link.isPending} onClick={() => find.mutate()}>
              {find.isPending ? "Looking…" : "Already added bump?"}
            </Button>
          </div>
          <p className="text-[12px] text-white/80">Bump wallet: {short(session.address)}</p>
          <Button size="sm" variant="outline" className="w-auto self-start" onClick={copy}>
            Copy wallet address
          </Button>
          {find.data && find.data.length === 0 && <p className="text-[12px] text-white/80">No account lists your bump wallet as an owner yet. Connect your dreamDEX wallet instead.</p>}
          {find.data?.map((account) => (
            <Button key={account} size="sm" variant="outline" className="w-auto self-start" disabled={link.isPending} onClick={() => link.mutate(account)}>
              Use {short(account)}
            </Button>
          ))}
        </>
      )}

      {external && (
        <>
          <p className="text-[12px] text-white/80">dreamDEX wallet: {short(external.address)}{external.address.toLowerCase() === session.address.toLowerCase() ? " (the wallet you signed in with)" : ""}</p>
          {lookup.isPending && <p className="text-[12px] text-white/80">Looking for your accounts…</p>}
          {lookup.isError && (
            <Button size="sm" variant="outline" className="w-auto self-start" onClick={() => findAccounts()}>
              Couldn&apos;t look up accounts. Try again
            </Button>
          )}
          {lookup.data && lookup.data.length === 0 && <p className="text-[12px] text-white/80">This wallet doesn&apos;t control a dreamDEX account yet. Open dreamDEX with it once, then try again.</p>}
          {lookup.data?.map((account) => (
            <div key={account.address} className="flex flex-col gap-0.5">
              <Button size="sm" variant="outline" className="w-auto self-start" disabled={busy || account.threshold !== 1 || (!account.ready && !account.ownsIt)} onClick={() => pick(account)}>
                {connect.isPending && connect.variables?.address === account.address ? "Approve in your wallet…" : `Use ${short(account.address)}`}
              </Button>
              {account.threshold !== 1 && <p className="text-[12px] text-white/80">Needs {account.threshold} signatures, so bump can&apos;t trade through it.</p>}
              {account.threshold === 1 && !account.ready && !account.ownsIt && (
                <p className="text-[12px] text-white/80">This wallet isn&apos;t an owner of {short(account.address)} on Hideki yet. In dreamDEX, open the wallet, tap Manage and add it on this network, then try again.</p>
              )}
            </div>
          ))}
        </>
      )}
    </Card>
  );
}
