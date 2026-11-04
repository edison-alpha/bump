import { PositionDetailScreen } from "@/modules/positions/screens/position-detail-screen";

export default async function Page({ params }: { params: Promise<{ pool: string }> }) {
  const { pool } = await params;
  return <PositionDetailScreen pool={pool} />;
}
