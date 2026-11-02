const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const usd = (n: number) => usdFormat.format(n);

export const signedUsd = (n: number) => `${n < 0 ? "-" : "+"}${usd(Math.abs(n))}`;

export const signedPct = (n: number, digits = 2) => `${n < 0 ? "-" : "+"}${Math.abs(n).toFixed(digits)}%`;

export const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const maskEmail = (email: string) => {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;
