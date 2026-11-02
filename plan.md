# Rencana: bump × dreamDEX Perps (target ide 90/100)

## Context

bump sekarang adalah PWA "konsol genggam" untuk trading perps, tapi **semuanya masih simulasi**:
login mock (`modules/session/session-provider.tsx`), harga random walk (`modules/market/price-provider.tsx`),
posisi & saldo di localStorage (`modules/trade/trade-provider.tsx`), leaderboard dummy (`modules/leaderboard/data.ts`).

Dua alasan rencana ini dibuat:
1. **Integrasi dreamDEX perps (Somnia Hideki testnet)** supaya ada order on-chain nyata. Ini syarat MVP dreamDEX dan juga mainnet nanti.
2. **Pembeda dari PIPS** (juara 1 DeepBook Sui Overflow 2026, konsepnya sama: "konsol trading 3D di HP").
   Konsol saja tidak cukup. bump butuh lapisan yang tidak dimiliki PIPS: **Cartridge** (bot strategi yang dicolok)
   dan **Kabel Link** (duel PvP / copy teman).

Catatan: deadline Perps Builder Bounty (1 Nov 2026 23:59 UTC) sudah lewat. Tanyakan di Discord dreamDEX soal perpanjangan.
Rencana ini tetap berlaku untuk mainnet (bonus $200 jika order di mainnet ≤30 hari setelah launch) dan hackathon berikutnya.

Output pertama saat eksekusi: salin rencana ini ke `plan.md` di root repo bump.

## Keputusan utama

- **Login: Privy embedded wallet** (`@privy-io/react-auth` sudah terpasang). Email OTP cocok dengan layar Email→Verify yang ada.
  Signing tanpa popup cocok dengan tombol Bump (dua kali tekan). Fase 1: EOA trading langsung. Fase 2: Somnia smart account + session key untuk batch atomik order+TP/SL.
- **Mode tamu** tetap memakai simulasi lokal yang sekarang, sebagai mode latihan.
- **Repo** mengikuti pola sama: `bump` (frontend), `bump-backend` (Bun + Elysia + Postgres/PGlite + jose), `bump-packages` (workspace `@bump/*`). Ketiganya sejajar di `C:\Users\bayum\Downloads\`.
- **Trading dari browser**, user sebagai penanda tangan. Backend hanya memegang key operator untuk Cartridge dan faucet gas, tidak pernah key user.

## Fakta dreamDEX yang dipakai

- Chain `50383` (Hideki). RPC/WS `api.hideki2.infra.testnet.somnia.network`, indexer `hideki-dev.smk.somnia.host/v1/graphql`, gas STT.
- SDK `@somnia-chain/markets-sdk@0.32.1` (+ `/chains` `hidekiTestnet`, `/react` hooks). Wajib WebSocket.
- Cross-margin MarginBank (USDso `0xed79…4F72`). Leverage bukan parameter order: quantity = margin × leverage / harga, disejajarkan ke lot.
- Market order = IOC limit + slippage. TP/SL = `placePerpStopOrder` via `stopRegistry` (0,15 STT per stop, hanya oleh akun pemilik).
- Voucher 1.000 USDso: `getPerpVoucherEligibility` → `claimPerpVoucher`. BTC/ETH/SOL/BNB/XRP ada di allowlist.
- Read penting: `getMaxPerpOrderSize`, `previewPerpOrderMargin`, `previewPerpClosePnl`, `getAccountEquity`, `listPerpOrderHistory`, `listPerpStopOrders`, `getCandles`.
- Operator/bot: `placeOrderFor`/`cancelOrderFor`/`reduceOrderFor` lewat "Link a Bot" (izin per market, tidak bisa withdraw, tidak bisa pasang stop).

## Fase 0 — Spike (bukti on-chain)

`bump-packages/scripts/spike.ts` dengan private key testnet: listPerpMarkets → claim voucher → depositMargin →
open BTC long IOC → pasang TP+SL → batalkan stop → reduce-only close 100%. Catat semua tx hash.
Setiap kejanggalan SDK/docs dicatat ke `feedback/*.md` (format bounty).
Contoh yang sudah ketemu: PERPS.md bilang hanya BTC/ETH, padahal docs mencantumkan 21 market; contoh testnet di README memakai Shannon 50312, bukan Hideki.

## Fase 1 — bump-packages

| Paket | Isi |
|---|---|
| `@bump/shared` | Tipe domain dipindah dari `modules/trade/types.ts` (`Draft`, `Position`, `ClosedTrade`, `Side`, `CloseReason`) + skema zod |
| `@bump/api-types` | Kontrak HTTP bump-backend (auth, profile, leaderboard, gas, cartridge, duel) |
| `@bump/dreamdex` | `config` (chain, URL, pemetaan `btc`→`BTC-PERP` dari baris market); `units` (price 18 desimal, qty `baseDecimals`, tick/lot); `orders` (`draftToOrder`, `closeToOrder(percent)`, `limitsToStops`); `errors` (revert → pesan ramah) |
| `@bump/testkit` | Fixture market + test unit konversi (desimal 6–24 per market) |

Reuse rumus yang sudah ada di `modules/trade/calc.ts` (`positionSize`, `targetPrice`, `stopPrice`, `stepClosePct`) di dalam `orders`.

## Fase 2 — bump-backend (salin kerangka sama-backend)

- `lib/privy.ts`, `lib/session.ts`, `lib/env.ts`, `lib/errors.ts`, `lib/db/*`: salin dari `Hackathon/sama-backend/src/lib/` dan ganti nama cookie ke `bump_session`.
- `users`: profil, username, `showOnLeaderboard` (sekarang di localStorage `bump:session`).
- `gas`: faucet wallet → drip STT ke user baru (gas + 0,3 STT untuk TP/SL), dengan rate limit per user.
- `trades`: log tx hash per order (riwayat + bukti).
- `leaderboard`: cron `listAccountEquities` untuk user bump; PnL = Δ`totalEquity` − deposit/withdraw/credit (`getMarginEvents`).
- `watcher`: pantau fill stop/likuidasi via Somnia Reactivity → web push ke PWA.

## Fase 3 — Frontend: trading nyata

1. `app/providers.tsx`: tambah `PrivyProvider` (custom chain 50383, embedded wallet, wallet UI dimatikan) + `SomniaMarketsProvider`. Komponen `SignerBinding` memanggil `exchange.setSigner({ walletClient })`.
2. `session-provider.tsx`: `signIn` jadi Privy login → POST `/auth` backend. Layar `email-screen`/`verify-screen` memakai OTP Privy.
3. `price-provider.tsx`: random walk diganti feed live. API `useMarkets`/`useMarket`/`useSeries` dipertahankan supaya screen tidak berubah. Riwayat chart dari `getCandles`.
4. `trade-provider.tsx`: dipecah jadi `LocalTradeProvider` (tamu, kode yang sekarang) dan `ChainTradeProvider` (on-chain) dengan interface `TradeContextValue` yang sama.
   `openPosition` → IOC + 2 stop; `closePosition` → reduce-only; `updateLimits` → cancel+place stop; `balance` → `totalEquity`.
5. `order-progress-screen.tsx`: langkah nyata (sign → kirim → terisi → TP/SL terpasang), tx hash + link explorer.
6. `build-trade-screen`/`review-trade-screen`: validasi `getMaxPerpOrderSize` + `previewPerpOrderMargin` (min size, margin cukup).
   `close-position-screen`: `previewPerpClosePnl`.
7. `limit-watcher.tsx`: hanya aktif di mode tamu.
8. Onboarding "Charging up…": wallet dibuat → drip STT → claim voucher → deposit ke MarginBank.

## Fase 4 — Cartridge (bot strategi)

- Layar baru `/cartridges`: rak cartridge, colok → atur risiko pakai wheel → Bump untuk aktifkan.
- Cartridge pertama: **Guard** (kurangi/tutup posisi saat margin health turun) dan **Breakout**, porting dari `strategies/perp-*` dreamDEX bot kit.
- Runner di bump-backend memakai key operator yang di-link ke wallet user (Link a Bot / OperatorPermissionsRegistry), dengan izin per market.
- Builder fee (`builder`, `builderFeeBpsTimes1k`) disiapkan untuk cartridge komunitas di fase berikutnya.

## Fase 5 — Kabel Link (duel PvP)

- Duel 1v1 di BTC, ronde 60 detik, order on-chain sungguhan. Backend menyimpan room, timer, dan skor PnL dari `previewPerpClosePnl`/fills.
- Link tantangan + kartu hasil (gambar OG dengan maskot + PnL) yang bisa dibagikan ke X.
- Co-op/copy teman ditunda ke fase berikutnya.

## Fase 6 — Polish & komunikasi

Streak + musim mingguan mengikuti Perps Arena. Video demo 60 detik. 2–3 post X yang tag @DreamDEXSomnia.
README berisi: apa, untuk siapa, cara menjalankan, tx hash, dan bagian X posts.

## Verifikasi

- `@bump/testkit`: `bun test` untuk konversi unit (BTC, NEAR 24 desimal, XRP 6 desimal) dan pembulatan tick/lot.
- Spike: semua langkah sukses di explorer `explorer.testnet.somnia.network/tokyo`.
- Backend: `bun test` untuk auth (token Privy palsu ditolak), rate limit drip, dan hitungan PnL leaderboard.
- Frontend: `pnpm typecheck`, `pnpm test:e2e` (mode tamu tetap lulus), lalu manual di HP: login → open BTC $20 2x → TP/SL muncul di `listPerpStopOrders` → close 50% → close 100% → riwayat & saldo cocok dengan app.testnet.dreamdex.io.
- Cartridge Guard menutup posisi saat health turun (diuji dengan leverage tinggi di testnet). Duel 2 akun menghasilkan pemenang dan kartu hasil.
