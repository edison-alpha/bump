const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const smallUsdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4 });

const wholeUsdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const usd = (n: number) => Number.isFinite(n) ? usdFormat.format(n) : "…";

/** Like `usd`, but keeps 4 decimals for sub-dollar coins so their moves stay visible. */
export const usdPrice = (n: number) => Number.isFinite(n) ? (Math.abs(n) < 1 ? smallUsdFormat : usdFormat).format(n) : "…";

/** Price for tight spaces (the mini LCD): whole dollars from $1,000 up. */
export const usdPriceShort = (n: number) => (Math.abs(n) >= 1000 ? wholeUsdFormat.format(n) : usdPrice(n));

export const signedUsd = (n: number) => Number.isFinite(n) ? `${n < 0 ? "-" : "+"}${usd(Math.abs(n))}` : "…";

export const signedPct = (n: number, digits = 2) => Number.isFinite(n) ? `${n < 0 ? "-" : "+"}${Math.abs(n).toFixed(digits)}%` : "…";

export const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const maskEmail = (email: string) => {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Price rounding: cents for coins over $1, 5 decimals below that. */
export const roundPrice = (n: number) => (Math.abs(n) < 1 ? Math.round(n * 1e5) / 1e5 : round2(n));
