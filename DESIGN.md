# bump design system

The reference is 18 mobile screens (onboarding, trade flow, ranks, profile). This file records
what the design is made of so every screen is built from the same parts.

## 1. Concept: a toy console

The app reads like a handheld game console made of glossy blue plastic.

| Layer | What it looks like | How we build it |
| --- | --- | --- |
| **Bezel** (`.console` + `md:console-device`) | Thick, inflated sky-blue plastic. Bright specular highlight on the top-left, darker blue towards the bottom. | Phones / installed PWA: full-bleed, edge to edge, under the status bar and home indicator (safe-area padding); only the inner bevel. ≥768px: rounded 40px device with rim + floating shadow on a sky backdrop. |
| **Density** | Every screen fits the LCD on a ~390×844 phone without scrolling; scrolling is only the fallback on shorter phones. | Compact type scale (titles 24–28, money 28–38, rows 36px, buttons 48px). |
| **Screen** (`.screen-panel`) | Dark navy glass set *into* the bezel: dark-blue groove, thin light-blue rim, inner shadow at the top so it feels recessed. Radius ~26px. | `box-shadow` rings (groove + rim) + inset shadow. |
| **Top bar** | On trade/ranks/profile the title sits on the bezel itself (navy text, cream back pill). On auth/home the screen fills the bezel and the title is white inside. | `Screen variant="framed" \| "full"`. |
| **LCD behaviour** | The device is locked to the viewport; the page never scrolls. Only the screen content scrolls, under a glass glare + inner shadow. | `Screen` → `Lcd` |
| **Control deck** | Hardware, not a web tab bar (reference: handheld with PREV/NEXT keys, small mode keys, a big square key and a ribbed wheel). | `ConsoleDeck` |

### Control deck

| Control | Does |
| --- | --- |
| **PREV** key (charcoal) | Back. Keyboard ←. |
| **NEXT** key (charcoal, mint LED when live) | The current screen's main action, registered with `usePrimaryAction()` (Build → Review, Review → Confirm, Close → Close n%, Ranks → toggle wins/losses …). Keyboard →. |
| **Mode keys** HOME · TRADE · RANKS | Small pill keys with an LED on the active mode; disabled when signed out. |
| **Bump key** (gold square with the mascot, printed OPEN / CLOSE) | The trade trigger. No position: press → Review, press again → trade placed. Position open: press → Close Position, press again → closes the chosen amount. Two presses on purpose so a stray tap never trades. Signed out: goes to sign-in. Profile lives behind the Home avatar. |
| **Thumbwheel** (3D ribbed cylinder in a recessed slot) | A jog dial for values. Adjustable fields are wrapped in `DialField`; tap one (or tap the wheel itself / Enter, which moves to the next field) to select it (cyan ring + "DIAL" tag, wheel LED lights) and roll the wheel: one detent = one step with a haptic tick (margin $1, leverage next option, target/stop 0.5%, close amount 5%, chart timeframe on Live position). Drag, mouse-wheel or ↑/↓. On screens without dials it scrolls the LCD. |

All keys travel down on press and buzz (`navigator.vibrate`) on supported phones. Sound effects (`lib/sound.ts`, synthesized with Web Audio) play on every button press, on each wheel detent, when a trade opens, and when it closes (a rising arpeggio on profit, falling notes on a loss). "Powered by dreamDEX" is printed under the deck.

## 2. Material / elevation tokens

| Token | Use | Recipe |
| --- | --- | --- |
| `gloss` | Every candy surface (buttons, chips, active segments, back pill, tab active) | White highlight band over the top 45%, 3px darker lip at the bottom, tinted drop shadow. |
| `glass` | Cards on the screen (balance, rows, tables, steps) | Faint white top gradient, 1px light-blue border, inner top highlight. |
| `recess` | Inputs, OTP boxes, amount boxes, select | Darker fill + inner shadow, light-blue border. |
| `text-pop` | Big white headings on navy | `0 2px 0` dark text shadow. |

## 3. Colour

| Role | Value |
| --- | --- |
| Bezel | `#7fd6ff → #3db4ff → #1585ee` |
| Screen | `#11253f → #09162a` |
| Primary candy (blue) | `#48bfff → #128af6` |
| Long / profit | `#62f6be → #2cd396`, text `#3fe0a6` |
| Short / loss | `#ffa3ad → #f7717f`, danger button `#ff8b99 → #f2566b`, text `#ff6377` |
| Cream | `#ffffff → #f1e9da` |
| Gold (rank 1, coins, trophy, sparkles) | `#ffcb3d` |
| Link | `#4cc9ff` |

## 4. Type

- Display: **Fredoka** 600/700 for titles, numbers, buttons, chips, tab labels.
- Body: **Nunito** for labels and helper text.
- Scale: screen title 22, hero 32–36, money hero 36–44, button 18–21, label 15, caption 12.

## 5. Shape

Radius: bezel 40 · screen 26 · cards 16 · large buttons 18 · small buttons/segments 14 · chips 9 · back button full pill.

## 6. Illustration

- Mascot: `public/brand/mascot.png` (glow removed, trimmed). Accessories drawn in code: envelope, check badge, light bulb, yellow sparkles, clouds.
- Coins: glossy gradient crypto icons and a gold coin stack (SVG).
- **Needs real assets** (not reproducible in code): the 3D cartoon people avatars, the peeking/happy mascot poses. Drop PNGs in `public/avatars/` and `public/brand/` and they replace the generated ones.

## 7. Screen checklist

01 Welcome · 02 Email · 03 Verify · 04 Profile setup · 05 Home · 06 Pick market · 07 Build · 08 Review · 09 Order progress · 10 Live position · 11 Close · 12 Closed · 13/14 Leaderboard · 15 Profile.
