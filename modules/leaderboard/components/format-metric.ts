import { signedPct, signedUsd } from "@/lib/format";
import { toMetric, type Metric } from "../data";

export const formatMetric = (value: number, metric: Metric) =>
  metric === "usd" ? signedUsd(value) : signedPct(toMetric(value, metric));
