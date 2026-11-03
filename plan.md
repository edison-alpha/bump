# Rencana: bump × dreamDEX Perps (target ide 90/100)

## Context

bump adalah PWA "konsol genggam" untuk trading perps. **UX frontend sudah dirombak (Fase UX, selesai)**,
tapi datanya masih simulasi: login mock (`modules/session/session-provider.tsx`), harga random walk
(`modules/market/price-provider.tsx`), posisi & saldo di localStorage (`modules/trade/trade-provider.tsx`),
XP/misi di localStorage (`modules/progress/progress-provider.tsx`), leaderboard sampel (`modules/leaderboard/data.ts`).

Dua tujuan:
1. **Integrasi dreamDEX perps (Somnia Hideki testnet)** supaya ada order on-chain nyata. Ini syarat MVP dreamDEX dan juga mainnet nanti.
2. **Pembeda dari PIPS** (juara 1 DeepBook Sui Overflow 2026, konsepnya sama: "konsol trading 3D di HP").
   Konsol saja tidak cukup. bump butuh lapisan yang tidak dimiliki PIPS: **Cartridge** (bot strategi yang dicolok)
   dan **Kabel Link** (duel PvP / copy teman).

Catatan: deadline Perps Builder Bounty (1 Nov 2026 23:59 UTC) sudah lewat. Tanyakan di Discord dreamDEX soal perpanjangan.
Rencana ini tetap berlaku untuk mainnet (bonus $200 jika order di mainnet ≤30 hari setelah launch) dan hackathon berikutnya.

## Status

| Fase | Isi | Status |
|---|---|---|
| UX | Perombakan alur & tombol konsol (rincian di bawah) | ✅ Selesai, belum di-commit |
| 0 | Spike on-chain | ⏳ Butuh private key testnet + STT |
| 1 | bump-packages | ✅ shared, api-types, dreamdex (order, fill dari receipt, reader indexer), testkit (20 test) |
| 2 | bump-backend | ✅ auth Privy, profil, impor tamu, trade log diverifikasi dari fill (entry/exit/PnL/alasan dihitung server, close parsial), watcher TP/SL/likuidasi + web push, progress di server, leaderboard dari PnL on-chain, faucet (15 test). Cron equity diganti PnL per close (equity tercampur voucher/deposit) |
| 3 | Frontend → on-chain | ✅ Selesai kode: Privy + sesi backend, harga mark live + candle dreamDEX, 21 market dengan leverage per market (5x/10x/20x, turun untuk akun voucher), `ChainTradeProvider` (order IOC, TP/SL pair, close parsial, edit limit, klaim voucher), layar progress/close/limit nyata, progress+riwayat member dari server, kartu "Charging up". Belum terbukti on-chain: penulisan (butuh wallet ber-STT, faucet sengaja ditunda) |
| 4 | Cartridge | ⏳ |
| 5 | Kabel Link (duel) | ⏳ |
| 6 | Polish & komunikasi | ⏳ |

## Fase UX — sudah selesai

Yang sekarang ada di frontend, dan **wajib dipertahankan** saat integrasi:

- **Aturan tombol:** SELL/BUY hanya memilih arah. **BUMP ditahan 0,6 dtk** = satu-satunya aksi yang menaruh atau menutup trade
  (progress berjalan di border tombol). Tap singkat tidak pernah trading. NEXT menampilkan label aksinya. PREV mati di Home/Ranks.
  Kode: `components/console/action-key.tsx`, `components/console/console-deck.tsx`.
- **Toast LCD + coach key:** `flash()` dan `useCoachKey()` di `components/console/console-provider.tsx`.
- **Alur:** "Play now" (tamu) → tutorial 3 langkah (`modules/progress/components/coach.tsx`) → Pick → Build → tahan BUMP →
  Progress → Live → Closed ("Run it back", Share, XP) → Home (Hot call, misi, streak, level).
- **Gaya trade** (`STYLES` di `modules/trade/calc.ts`): Chill 2x (+1% / −0,5%), Spicy 5x (+1,5% / −1%), Wild 10x (+2% / −1%). Stake default $50.
- **Guard saldo:** `available`, `broke`, `blocker`, `refill()` di `trade-provider.tsx`. Rugi per trade dibatasi sebesar stake.
- **Progress:** XP (call 10, close 10, win 15, target 25), level, 3 misi harian (+30 XP), streak (`modules/progress/rules.ts`).
- **Leaderboard:** baris "Kamu" memakai PnL asli dari riwayat. Pemain lain masih data sampel.

## Keputusan utama

- **Login: Privy embedded wallet** (`@privy-io/react-auth` sudah terpasang). Email OTP cocok dengan layar Email→Verify.
  Signing **tanpa popup** wajib, karena tahan BUMP harus langsung mengeksekusi.
  Fase 3: EOA trading langsung. Fase 3b: Somnia smart account + session key untuk batch atomik order+TP/SL.
- **Mode tamu** tetap memakai simulasi lokal (`LocalTradeProvider`). Tamu yang login tetap menyimpan XP dan riwayatnya.
- **Repo** mengikuti pola sama: `bump` (frontend), `bump-backend` (Bun + Elysia + Postgres/PGlite + jose), `bump-packages` (workspace `@bump/*`). Ketiganya sejajar di `C:\Users\bayum\Downloads\`.
- **Trading dari browser**, user sebagai penanda tangan. Backend hanya memegang key operator (Cartridge) dan faucet gas, tidak pernah key user.

## Fakta dreamDEX yang dipakai

- Chain `50383` (Hideki). RPC/WS `api.hideki2.infra.testnet.somnia.network`, indexer `hideki-dev.smk.somnia.host/v1/graphql`, gas STT.
- SDK `@somnia-chain/markets-sdk@0.32.1` (+ `/chains` `hidekiTestnet`, `/react` hooks). Wajib WebSocket.
- Cross-margin MarginBank (USDso `0xed79…4F72`). Leverage bukan parameter order: quantity = stake × leverage / harga, disejajarkan ke lot.
- Market order = IOC limit + slippage. TP/SL = `placePerpStopOrder` via `stopRegistry` (0,15 STT per stop, hanya oleh akun pemilik).
- Voucher 1.000 USDso: `getPerpVoucherEligibility` → `claimPerpVoucher`. BTC/ETH/SOL/BNB/XRP ada di allowlist.
- Batas leverage: BTC/ETH/SOL/XRP 20x, BNB 10x. Jadi Wild 10x aman di kelima market,
  **tapi cek `voucherLeverageCapX`** (batas leverage untuk saldo voucher) lewat `getPerpLeverage`.
- Read penting: `getMaxPerpOrderSize`, `previewPerpOrderMargin`, `previewPerpClosePnl`, `getAccountEquity`, `listPerpOrderHistory`, `listPerpStopOrders`, `getCandles`.
- Operator/bot: `placeOrderFor`/`cancelOrderFor`/`reduceOrderFor` lewat "Link a Bot" (izin per market, tidak bisa withdraw, tidak bisa pasang stop).

## Fase 0 — Spike (bukti on-chain)

`bump-packages/scripts/spike.ts` dengan private key testnet: listPerpMarkets → claim voucher → depositMargin →
open BTC long IOC dengan setelan Chill ($50, 2x) → pasang TP +1% & SL −0,5% → batalkan stop → reduce-only close 100%. Catat semua tx hash.
Sekaligus ukur: **berapa lama trade Chill selesai di harga nyata** (target/stop mungkin perlu disetel ulang),
dan apakah SL −0,5% lolos `tickSize` serta tidak langsung terpicu oleh spread.
Setiap kejanggalan SDK/docs dicatat ke `feedback/*.md` (format bounty).
Contoh yang sudah ketemu: PERPS.md bilang hanya BTC/ETH, padahal docs mencantumkan 21 market; contoh testnet di README memakai Shannon 50312, bukan Hideki.

## Fase 1 — bump-packages

| Paket | Isi |
|---|---|
| `@bump/shared` | Tipe domain dipindah dari `modules/trade/types.ts` (`Draft`, `Position`, `ClosedTrade`, `Side`, `CloseReason`), `STYLES`, `modules/progress/rules.ts` (XP, misi, level) + skema zod |
| `@bump/api-types` | Kontrak HTTP bump-backend (auth, profile, progress, leaderboard, gas, cartridge, duel) |
| `@bump/dreamdex` | `config` (chain, URL, pemetaan `btc`→`BTC-PERP` dari baris market); `units` (price 18 desimal, qty `baseDecimals`, tick/lot); `orders` (`draftToOrder`, `closeToOrder(percent)`, `limitsToStops`); `errors` (revert → pesan pendek untuk `flash()` / `blocker`) |
| `@bump/testkit` | Fixture market + test unit konversi (desimal 6–24 per market) |

Rumus yang dipakai ulang dari `modules/trade/calc.ts`: `positionSize`, `targetPrice`, `stopPrice`, `targetProgress`, `stepClosePct`.

## Fase 2 — bump-backend (salin kerangka sama-backend)

- `lib/privy.ts`, `lib/session.ts`, `lib/env.ts`, `lib/errors.ts`, `lib/db/*`: salin dari `Hackathon/sama-backend/src/lib/` dan ganti nama cookie ke `bump_session`.
- `users`: profil, username, `showOnLeaderboard` (sekarang di localStorage `bump:session`). Endpoint impor data tamu saat login.
- `progress`: XP, misi, dan streak dihitung **di server** dari fill on-chain (anti curang). `progress-provider.tsx` lalu cukup membaca hasilnya.
- `gas`: faucet wallet → drip STT ke user baru (gas + 0,3 STT untuk TP/SL), dengan rate limit per user.
- `trades`: log tx hash per order (riwayat + bukti).
- `leaderboard`: cron `listAccountEquities` untuk user bump; PnL = Δ`totalEquity` − deposit/withdraw/credit (`getMarginEvents`). Menggantikan data sampel di `modules/leaderboard/data.ts`.
- `watcher`: pantau fill stop/likuidasi via Somnia Reactivity → web push ke PWA ("Target hit!" saat aplikasi tertutup).

## Fase 3 — Frontend: trading nyata

1. `app/providers.tsx`: tambah `PrivyProvider` (custom chain 50383, embedded wallet, wallet UI dimatikan) + `SomniaMarketsProvider`. Komponen `SignerBinding` memanggil `exchange.setSigner({ walletClient })`.
2. `session-provider.tsx`: `signIn` jadi Privy login → POST `/auth` backend. `email-screen`/`verify-screen` memakai OTP Privy.
3. `price-provider.tsx`: random walk diganti feed live. API `useMarkets`/`useMarket`/`useSeries` dipertahankan supaya screen tidak berubah. Riwayat chart dari `getCandles`.
4. `trade-provider.tsx` dipecah jadi `LocalTradeProvider` (tamu, kode yang sekarang) dan `ChainTradeProvider` (member). Keduanya mengikuti interface `TradeContextValue` yang sudah ada:
   - `openPosition` → IOC + 2 stop, return `false` + alasan kalau ditolak (ditampilkan oleh layar Progress yang sudah ada).
   - `closePosition` → reduce-only. `updateLimits` → cancel + place stop.
   - `balance`/`available` → `getAccountEquity` (`totalEquity`) / free collateral.
   - `blocker` → dari `getMaxPerpOrderSize` (`placeable`, `limitedBy`) + saldo STT untuk stop.
   - `broke`/`refill` → klaim voucher / minta drip ke backend.
5. `order-progress-screen.tsx`: langkah nyata (tanda tangan → kirim → terisi → TP/SL terpasang), tx hash + link explorer.
6. `close-position-screen.tsx`: angka "You'd win/lose" dari `previewPerpClosePnl`.
7. `limit-watcher.tsx`: hanya aktif di mode tamu (di on-chain, stop dipegang exchange).
8. Onboarding "Charging up…" setelah login: wallet dibuat → drip STT → klaim voucher → deposit ke MarginBank.
9. Teks: "Lose at most" dan "It's the most you can lose" harus jujur di mode real. Dengan cross-margin, stop bisa slip, jadi tambahkan "≈".

**3b (setelah 3 stabil):** smart account + session key → order + TP + SL dalam satu transaksi atomik, sehingga satu kali tahan BUMP = satu transaksi.

## Fase 4 — Cartridge (bot strategi)

- Layar baru `/cartridges`: rak cartridge, colok → atur risiko pakai wheel → tahan BUMP untuk aktifkan (aturan tombol yang sama).
- Cartridge pertama: **Guard** (kurangi/tutup posisi saat margin health turun) dan **Breakout**, porting dari `strategies/perp-*` dreamDEX bot kit.
- Runner di bump-backend memakai key operator yang di-link ke wallet user (Link a Bot / OperatorPermissionsRegistry), dengan izin per market.
- Misi & XP baru untuk cartridge ("Biarkan Guard jalan 1 jam").
- Builder fee (`builder`, `builderFeeBpsTimes1k`) disiapkan untuk cartridge komunitas di fase berikutnya.

## Fase 5 — Kabel Link (duel PvP)

- Duel 1v1 di BTC, ronde 60 detik, order on-chain sungguhan. Backend menyimpan room, timer, dan skor PnL dari fills.
- Link tantangan dari tombol Share di layar Closed + kartu hasil (gambar OG dengan maskot + PnL) yang bisa dibagikan ke X.
- Co-op/copy teman ditunda ke fase berikutnya.

## Fase 6 — Polish & komunikasi

- Share sebagai **kartu gambar** (sekarang masih teks). Skin/warna bezel yang terbuka dengan naik level.
- Musim mingguan mengikuti Perps Arena.
- Video demo 60 detik. 2–3 post X yang tag @DreamDEXSomnia.
- README berisi: apa, untuk siapa, cara menjalankan, tx hash, dan bagian X posts.

## Verifikasi

- Setiap fase: `pnpm typecheck` + `pnpm build`, lalu jalankan alur di browser dengan viewport 390×844
  (Welcome → Play now → BUY → tahan BUMP → Live → tahan BUMP → Closed). Ini yang dipakai untuk memverifikasi Fase UX.
- `@bump/testkit`: `bun test` untuk konversi unit (BTC, NEAR 24 desimal, XRP 6 desimal) dan pembulatan tick/lot.
- Spike: semua langkah sukses di explorer `explorer.testnet.somnia.network/tokyo`.
- Backend: `bun test` untuk auth (token Privy palsu ditolak), rate limit drip, hitungan XP dari fill, dan PnL leaderboard.
- Frontend on-chain, manual di HP: login → Chill BTC $50 → TP/SL muncul di `listPerpStopOrders` → close 50% → close 100% → riwayat & saldo cocok dengan app.testnet.dreamdex.io. Mode tamu tetap jalan seperti sekarang.
- Cartridge Guard menutup posisi saat health turun (diuji dengan leverage tinggi di testnet). Duel 2 akun menghasilkan pemenang dan kartu hasil.
