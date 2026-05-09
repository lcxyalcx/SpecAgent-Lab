import { AnalyticsDashboard } from "@/components/dashboard/analytics-dashboard";
import { loadDashboardPayload } from "@/lib/dashboard/load-dashboard";

export default async function DashboardPage() {
  const payload = await loadDashboardPayload();

  return <AnalyticsDashboard payload={payload} />;
}
