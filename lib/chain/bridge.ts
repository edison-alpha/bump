import { BridgeToken, ChainId, getBridgeNetwork, getBridgeToken, hidekiTestnet, somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { createPublicClient, decodeEventLog, http, parseAbi, type Address, type Hex, type PublicClient, type TransactionReceipt } from "viem";

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

/** True once the destination Mailbox has processed that message. A view, so it is safe to ask as often as needed. */
export async function isDelivered(side: BridgeSide, mailbox: Address, messageId: Hex): Promise<boolean> {
  return bridgeClient(side).readContract({ address: mailbox, abi: mailboxAbi, functionName: "delivered", args: [messageId] });
}
