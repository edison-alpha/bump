"use client";

import { useMemo } from "react";
import { usePrivy, useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { useMutation } from "@tanstack/react-query";
import { createWalletClient, custom, type Address } from "viem";
import { HIDEKI } from "@/lib/bump/dreamdex";
import { exchange } from "@/lib/chain/exchange";
import { useSession } from "@/modules/session/session-provider";

export type DreamdexAccount = { address: string; threshold: number; ownsIt: boolean; ready: boolean };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The reason a write through the account failed, in words a player can act on. */
function reason(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/reject|denied|cancel/i.test(text)) return "You cancelled the request in your wallet.";
  if (/insufficient|funds|gas/i.test(text)) return "Your dreamDEX wallet needs STT for gas to approve this. Top it up and try again.";
  if (/GS025|GS020/.test(text)) return "That wallet isn't a direct owner of the account.";
  return "Couldn't connect the account. Try again.";
}

/**
 * Connects the player's dreamDEX wallet to bump. The wallet they use on dreamDEX is linked to their sign-in once (Privy),
 * its smart accounts are looked up, and, for the one they pick, that wallet signs a single owner change that adds the
 * bump wallet as an owner. From then on the bump wallet trades through the account without prompts, so the balance and
 * the voucher stay where they are.
 */
export function useDreamdexConnect() {
  const { session, linkTradingAccount } = useSession();
  const { linkWallet } = usePrivy();
  const { wallets } = useWallets();

  /**
   * The player's own wallet (MetaMask, …). Either a second wallet linked next to the bump one, or, when they signed in
   * with that wallet, the bump wallet itself: then there is nothing to link and nothing to add as an owner.
   */
  const external = useMemo<ConnectedWallet | null>(() => {
    const other = wallets.find((w) => w.walletClientType !== "privy" && !same(w.address, session.address));
    if (other) return other;
    return wallets.find((w) => w.walletClientType !== "privy" && same(w.address, session.address)) ?? null;
  }, [wallets, session.address]);

  const lookup = useMutation({
    mutationFn: async (): Promise<DreamdexAccount[]> => {
      if (!external) throw new Error("Connect your dreamDEX wallet first.");
      const { accounts } = exchange().client;
      const owner = external.address as Address;
      // the indexer can lag behind a network the account was just added on, so Wallet 1 is also read from the chain
      const listed = (await accounts.listControlledAccounts(owner)).map((a) => a.address as string);
      const wallet1 = accounts.addressOf(owner, 0n) as string;
      const addresses = [...new Set([...listed, wallet1])];
      const rows = await Promise.all(
        addresses.map(async (address): Promise<DreamdexAccount | null> => {
          try {
            const owners = await accounts.ownersOf(address as Address);
            return {
              address,
              threshold: Number(owners.threshold),
              ownsIt: owners.owners.some((o) => same(o.address, session.address)),
              ready: owners.owners.some((o) => same(o.address, owner)),
            };
          } catch {
            return null; // not deployed on this network
          }
        }),
      );
      return rows.filter((r): r is DreamdexAccount => r !== null);
    },
  });

  const connect = useMutation({
    mutationFn: async (account: DreamdexAccount) => {
      if (account.threshold !== 1) throw new Error("That account needs more than one signature, so bump can't trade through it.");
      if (!account.ownsIt) {
        if (!external) throw new Error("Connect your dreamDEX wallet first.");
        if (!account.ready) throw new Error("Your dreamDEX wallet isn't an owner of that account.");
        if (same(external.address, session.address)) throw new Error("Your wallet isn't an owner of that account yet.");
        const { client } = exchange();
        await external.switchChain(HIDEKI.chainId);
        const provider = await external.getEthereumProvider();
        const walletClient = createWalletClient({ account: external.address as Address, chain: HIDEKI.chain, transport: custom(provider) });
        // the dreamDEX wallet is a direct owner, so it only sends: the account approves its own owner change
        const act = client.createExecutor({ smartAccount: account.address as Address, inner: client.createExecutor({ walletClient }) });
        await act.execute([client.accounts.buildAddOwner(account.address as Address, session.address as Address, 1n)]);
        const after = await client.accounts.ownersOf(account.address as Address);
        if (!after.owners.some((o) => same(o.address, session.address))) throw new Error("The owner change didn't go through. Try again.");
      }
      await linkTradingAccount(account.address);
    },
  });

  return {
    /** The dreamDEX wallet, once the player has connected it. */
    external,
    /** Opens Privy's wallet picker to link the wallet they use on dreamDEX. */
    connectWallet: () => linkWallet(),
    lookup,
    connect,
    reason,
  };
}
