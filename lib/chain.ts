import { defineChain } from "viem";

/**
 * Somnia Hideki testnet, where dreamDEX perps run. Same endpoints as the markets SDK's `hidekiTestnet` (v2, after the
 * 2026-09-17 regenesis on the same chain id); defined here so the app does not pull the SDK in just for a chain.
 */
export const hideki = defineChain({
  id: 50383,
  name: "Hideki Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://api.hideki2.infra.testnet.somnia.network"],
      webSocket: ["wss://api.hideki2.infra.testnet.somnia.network/ws"],
    },
  },
  testnet: true,
});
