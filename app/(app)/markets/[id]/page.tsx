import { MarketDetailScreen } from "@/modules/trade/screens/market-detail-screen";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MarketDetailScreen marketId={id} />;
}
