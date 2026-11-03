"use client";

import { useWallets } from "@privy-io/react-auth";
import { BridgeToken, ChainId, createBridgeTransfer, getBridgeToken, somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPublicClient, createWalletClient, custom, erc20Abi, formatUnits, http, parseUnits, type Address } from "viem";
import { useConsole } from "@/components/console/console-provider";
import { Button } from "@/components/ui/button";
import { shortError } from "@/lib/bump/dreamdex";
import { useTrade } from "@/modules/trade/trade-provider";

const origin = getBridgeToken(BridgeToken.USDso, ChainId.somniaShannon);
const originClient = createPublicClient({ chain: somniaShannon, transport: http() });

/**
 * USDso sent "To Somnia" from dreamDEX lands on the general-purpose Somnia Testnet, not on Hideki where bump trades.
 * This is the SDK's Hyperlane bridge, Somnia Testnet to Hideki: it shows what the wallet holds there and carries it
 * across, straight to the account that trades. Renders nothing while the wallet holds no USDso on Somnia Testnet.
 */
export function BridgeToHideki() {
  const { setup } = useTrade();
  const { wallets } = useWallets();
  const { flash } = useConsole();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");

  const wallet = setup?.address as Address | undefined;

  const held = useQuery({
    queryKey: ["bump", "bridge", "somnia-usdso", wallet],
    enabled: !!wallet && !!origin?.address,
    refetchInterval: 10_000,
    queryFn: async () => {
      const raw = await originClient.readContract({ address: origin?.address as Address, abi: erc20Abi, functionName: "balanceOf", args: [wallet as Address] });
      return formatUnits(raw, origin?.decimals ?? 18);
    },
  });

  const bridge = useMutation({
    mutationFn: async (amount: string) => {
      if (!setup || !wallet || !origin) throw new Error("Your wallet isn't ready yet.");
      try {
        const raw = parseUnits(amount, origin.decimals);
        if (raw <= 0n) throw new Error("Enter an amount to bridge.");
        if (raw > parseUnits(held.data ?? "0", origin.decimals)) throw new Error(`Your wallet holds ${held.data ?? "0"} USDso on Somnia Testnet.`);
        const privy = wallets.find((w) => w.address.toLowerCase() === wallet.toLowerCase());
        if (!privy) throw new Error("Your wallet isn't ready yet. Try again in a moment.");
        await privy.switchChain(ChainId.somniaShannon);
        const walletClient = createWalletClient({ account: wallet, chain: somniaShannon, transport: custom(await privy.getEthereumProvider()) });
        const plan = createBridgeTransfer({ token: BridgeToken.USDso, from: ChainId.somniaShannon, to: ChainId.hidekiTestnet, amount: raw, recipient: setup.account as Address });
        // the approval has to land before the bridge call, or the transfer reverts
        for (const step of [plan.approveStep, plan.bridgeStep]) {
          if (!step) continue;
          const hash = await walletClient.sendTransaction({ to: step.to, data: step.data, value: step.value });
          await originClient.waitForTransactionReceipt({ hash });
        }
      } catch (error) {
        throw new Error(shortError(error));
      }
    },
    onSuccess: () => {
      setValue("");
      void held.refetch();
      void queryClient.invalidateQueries({ queryKey: ["bump", "chain"] });
      flash("Bridged. It lands on Hideki in a few seconds.", "good");
    },
    onError: (error: Error) => flash(error.message, "warn"),
  });

  if (!origin || !held.data || Number(held.data) <= 0) return null;

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        bridge.mutate(value.trim());
      }}
    >
      <p className="text-[12px] text-white/80">
        Your wallet holds {Number(held.data).toLocaleString("en-US", { maximumFractionDigits: 4 })} USDso on Somnia Testnet, not on Hideki where bump trades. Bridge it
        {setup?.linked ? " to your dreamDEX account" : ""}.
      </p>
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="Amount"
          aria-label="Amount of USDso to bridge to Hideki"
          className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-[14px] tabular-nums outline-none placeholder:text-white/50 focus:bg-white/15"
        />
        <Button type="button" size="sm" variant="outline" className="w-auto" onClick={() => setValue(held.data)}>
          Max
        </Button>
        <Button type="submit" size="sm" className="w-auto" disabled={bridge.isPending || !value}>
          {bridge.isPending ? "Bridging…" : "Bridge"}
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-white/50">Needs a little STT on Somnia Testnet for gas. Test bridge: testnet funds only.</p>
    </form>
  );
}
