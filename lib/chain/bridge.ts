import { BridgeToken, ChainId, getBridgeNetwork, getBridgeToken, hidekiTestnet, somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { createPublicClient, decodeEventLog, http, numberToHex, parseAbi, type Address, type Hex, type PublicClient, type TransactionReceipt } from "viem";

/** Puts the wallet on `chainId`. switchChain can resolve while the provider still reports the old chain, so ask the provider too. */
export async function switchTo(privy: ConnectedWallet, chainId: number, name: string) {
  const provider = await privy.getEthereumProvider();
  const chainIdOf = async () => Number(await provider.request({ method: "eth_chainId" }));
  await privy.switchChain(chainId);
  if ((await chainIdOf()) !== chainId) await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: numberToHex(chainId) }] });
  for (let i = 0; i < 20 && (await chainIdOf()) !== chainId; i++) await new Promise((resolve) => setTimeout(resolve, 250));
  const now = await chainIdOf();
  if (now !== chainId) throw new Error(`Your wallet stayed on chain ${now}. Switch it to ${name} (${chainId}) and try again.`);
  return provider;
}

/** The two ends of Somnia's Hyperlane lane, and the tokens bump moves across it. */
export type BridgeSide = "somnia" | "hideki";
export type BridgeAsset = "USDso" | "STT";

export const SIDES = {
  somnia: { chainId: ChainId.somniaShannon, chain: somniaShannon, name: "Somnia Testnet", short: "Somnia", logo: "/tokens/somnia.png", plate: "bg-white" },
  hideki: { chainId: ChainId.hidekiTestnet, chain: hidekiTestnet, name: "Hideki Testnet", short: "Hideki", logo: "/tokens/dreamdex.png", plate: "bg-navy-950" },
} as const;

export const ASSETS: Record<BridgeAsset, { token: (typeof BridgeToken)[keyof typeof BridgeToken]; logo: string }> = {
  USDso: { token: BridgeToken.USDso, logo: "/tokens/usdso.png" },
  STT: { token: BridgeToken.STT, logo: "/tokens/somnia.png" },
};

/** Somnia's mempool admits a transaction only when the balance covers gas × max fee (0.6 STT) on top of its value. */
export const GAS_ENVELOPE_STT = 0.6;

const clients: Partial<Record<BridgeSide, PublicClient>> = {};
export function bridgeClient(side: BridgeSide): PublicClient {
  clients[side] ??= createPublicClient({ chain: SIDES[side].chain, transport: http() }) as PublicClient;
  return clients[side] as PublicClient;
}

export const otherSide = (side: BridgeSide): BridgeSide => (side === "somnia" ? "hideki" : "somnia");

export function routeOf(asset: BridgeAsset, from: BridgeSide) {
  const origin = getBridgeToken(ASSETS[asset].token, SIDES[from].chainId);
  const destination = getBridgeToken(ASSETS[asset].token, SIDES[otherSide(from)].chainId);
  const mailbox = getBridgeNetwork(SIDES[otherSide(from)].chainId)?.mailbox ?? null;
  const originMailbox = getBridgeNetwork(SIDES[from].chainId)?.mailbox ?? null;
  return { origin, destination, mailbox, originMailbox };
}

const mailboxAbi = parseAbi([
  "event Dispatch(address indexed sender, uint32 indexed destination, bytes32 indexed recipient, bytes message)",
  "event DispatchId(bytes32 indexed messageId)",
  "function delivered(bytes32 messageId) view returns (bool)",
]);

/**
 * The Hyperlane message id of a transfer, read from its origin receipt: the origin Mailbox's `Dispatch` sent by the origin
 * router, and the `DispatchId` that follows it. Null when the receipt holds no such pair.
 */
export function messageIdOf(receipt: TransactionReceipt, mailbox: Address, router: Address): Hex | null {
  const logs = receipt.logs.filter((log) => log.address.toLowerCase() === mailbox.toLowerCase());
  for (let i = 0; i < logs.length; i++) {
    try {
      const event = decodeEventLog({ abi: mailboxAbi, data: logs[i].data, topics: logs[i].topics });
      if (event.eventName !== "Dispatch" || event.args.sender.toLowerCase() !== router.toLowerCase()) continue;
      for (let j = i + 1; j < logs.length; j++) {
        const next = decodeEventLog({ abi: mailboxAbi, data: logs[j].data, topics: logs[j].topics });
        if (next.eventName === "DispatchId") return next.args.messageId;
      }
    } catch {
      // another event of the Mailbox: not the one we want
    }
  }
  return null;
}

const routerAbi = parseAbi(["function quoteGasPayment(uint32 destinationDomain) view returns (uint256)"]);

/**
 * Whether the router's dispatch hook answers. `transferRemote` asks the hook for a quote and then runs its post-dispatch;
 * a router whose hook is not a real Hyperlane hook reverts on both, so every transfer through it fails after the
 * tokens were pulled (the revert undoes that, but the gas is spent). The quote is a free read.
 */
export async function hookAnswers(side: BridgeSide, router: Address): Promise<boolean> {
  try {
    await bridgeClient(side).readContract({ address: router, abi: routerAbi, functionName: "quoteGasPayment", args: [SIDES[otherSide(side)].chainId] });
    return true;
  } catch {
    return false;
  }
}

/** Dry-runs a bridge step as `from` (eth_call, nothing is sent): false when the chain would revert it. */
export async function stepWouldSucceed(side: BridgeSide, from: Address, step: { to: Address; data: Hex; value: bigint }, gas: bigint): Promise<boolean> {
  try {
    await bridgeClient(side).call({ account: from, to: step.to, data: step.data, value: step.value, gas });
    return true;
  } catch {
    return false;
  }
}

/** True once the destination Mailbox has processed that message. A view, so it is safe to ask as often as needed. */
export async function isDelivered(side: BridgeSide, mailbox: Address, messageId: Hex): Promise<boolean> {
  return bridgeClient(side).readContract({ address: mailbox, abi: mailboxAbi, functionName: "delivered", args: [messageId] });
}
