import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { HIDEKI } from "@/lib/bump/dreamdex";

let instance: SomniaMarkets | null = null;

/**
 * The app's one dreamDEX exchange on Hideki. Created on first use in the browser (never during prerender); the
 * WebSocket opens lazily on the first chain read. The member's embedded wallet is bound to it by the chain trade
 * provider with `setSigner`.
 */
export function exchange(): SomniaMarkets {
  if (typeof window === "undefined") throw new Error("The dreamDEX exchange only runs in the browser.");
  instance ??= new SomniaMarkets({ indexerUrl: HIDEKI.indexerUrl, chain: HIDEKI.chain, addresses: HIDEKI.addresses });
  return instance;
}
