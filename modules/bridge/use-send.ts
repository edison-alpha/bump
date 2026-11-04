"use client";

import { useWallets } from "@privy-io/react-auth";
import { DEFAULT_FEES } from "@somnia-chain/markets-sdk";
import { useCallback } from "react";
import { createWalletClient, custom, encodeFunctionData, erc20Abi, type Address, type Hex } from "viem";
import { bridgeClient, SIDES, switchTo, TX_GAS, type BridgeSide } from "@/lib/chain/bridge";
import { exchangeOn } from "@/lib/chain/exchange";
import type { Token } from "@/lib/chain/swap";

export type SendRequest = {
  chain: BridgeSide;
  token: Token;
  to: Address;
  /** Amount in the token's smallest unit. */
  raw: bigint;
  /** The sign-in wallet: it signs, and pays gas. */
  wallet: Address;
  /** Send from this dreamDEX smart account instead of the wallet. The wallet must be one of its owners. */
  fromAccount?: Address;
};

/**
 * Sends a token (the native coin or an ERC-20) from the wallet, or from the linked dreamDEX smart account, and resolves
 * the transaction hash once it is mined. A reverted transaction throws: nothing moved, only gas was spent.
 */
export function useSender() {
  const { wallets } = useWallets();
  return useCallback(
    async ({ chain, token, to, raw, wallet, fromAccount }: SendRequest): Promise<Hex> => {
      const privy = wallets.find((w) => w.address.toLowerCase() === wallet.toLowerCase());
      if (!privy) throw new Error("Your wallet isn't ready yet. Try again in a moment.");
      const side = SIDES[chain];
      const provider = await switchTo(privy, side.chainId, side.name);
      const walletClient = createWalletClient({ account: wallet, chain: side.chain, transport: custom(provider) });

      if (fromAccount) {
        // the account sends, the wallet only signs and pays gas
        const { client } = exchangeOn(chain);
        const call = token.address
          ? { chainId: side.chainId, to: token.address, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, raw] }), value: 0n, description: `Send ${token.symbol}` }
          : { chainId: side.chainId, to, data: "0x" as Hex, value: raw, description: `Send ${token.symbol}` };
        const act = client.createExecutor({ smartAccount: fromAccount, inner: client.createExecutor({ walletClient }) });
        const done = await act.execute([call]);
        if (done.receipt.status !== "success" || done.failure) throw new Error("The transfer reverted, so nothing moved.");
        return done.hash;
      }

      // gas and fees are fixed, like the SDK's own writes, so the wallet has nothing to estimate
      const hash = token.address
        ? await walletClient.writeContract({ address: token.address, abi: erc20Abi, functionName: "transfer", args: [to, raw], gas: TX_GAS, ...DEFAULT_FEES })
        : await walletClient.sendTransaction({ to, value: raw, gas: TX_GAS, ...DEFAULT_FEES });
      const receipt = await bridgeClient(chain).waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transfer reverted, so nothing moved.");
      return hash;
    },
    [wallets],
  );
}
