import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { HIDEKI } from "@/lib/bump/dreamdex";
import type { BridgeSide } from "@/lib/chain/bridge";

/**
 * The registry the perp pools check for operator grants. The SDK's Hideki address set does not carry it, and without it
 * every TP/SL placement fails before anything is sent (NotConfiguredError: operatorPermissionsRegistry). Read off the
 * chain: for every owner whose stop the pool accepts, this registry reports the stop registry as globally approved.
 */
const OPERATOR_PERMISSIONS_REGISTRY = "0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a" as const;

let instance: SomniaMarkets | null = null;
let somnia: SomniaMarkets | null = null;

/**
 * The app's one dreamDEX exchange on Hideki. Created on first use in the browser (never during prerender); the
 * WebSocket opens lazily on the first chain read. The member's embedded wallet is bound to it by the chain trade
 * provider with `setSigner`.
 */
export function exchange(): SomniaMarkets {
  if (typeof window === "undefined") throw new Error("The dreamDEX exchange only runs in the browser.");
  instance ??= new SomniaMarkets({ indexerUrl: HIDEKI.indexerUrl, chain: HIDEKI.chain, addresses: { ...HIDEKI.addresses, operatorPermissionsRegistry: OPERATOR_PERMISSIONS_REGISTRY } });
  return instance;
}

/** Somnia Testnet's own indexer; its spot markets are separate from Hideki's. */
const SOMNIA_TESTNET_INDEXER = "https://dev.smk.somnia.host/v1/graphql";

/**
 * The exchange on the general-purpose Somnia Testnet. Only the swap screen uses it (spot markets): perps and the
 * wallet's trading stay on Hideki.
 */
export function somniaExchange(): SomniaMarkets {
  if (typeof window === "undefined") throw new Error("The dreamDEX exchange only runs in the browser.");
  somnia ??= new SomniaMarkets({ indexerUrl: SOMNIA_TESTNET_INDEXER, chain: somniaShannon, addresses: SOMNIA_TESTNET_ADDRESSES });
  return somnia;
}

/** The exchange for one side of the Somnia ↔ Hideki lane. */
export const exchangeOn = (side: BridgeSide): SomniaMarkets => (side === "somnia" ? somniaExchange() : exchange());
