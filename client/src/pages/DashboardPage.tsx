import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchStats, fetchTicketsPerDay, type Stats, type TicketsPerDayPoint } from "@/lib/ticket-api";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "< 1 min";
}

function formatDateLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-20" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession();

  const statsQuery = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });

  const chartQuery = useQuery<TicketsPerDayPoint[]>({
    queryKey: ["stats", "tickets-per-day"],
    queryFn: fetchTicketsPerDay,
  });

  const chartData = chartQuery.data?.map((p) => ({ ...p, label: formatDateLabel(p.date) }));

  // Show every ~7th label to avoid crowding on 30 days
  const tickFormatter = (label: string, index: number) =>
    index % 5 === 0 ? label : "";

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={session?.user.name ?? ""} />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-8">Dashboard</h1>

        {(statsQuery.isError || chartQuery.isError) && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load dashboard data. Please try again.</AlertDescription>
          </Alert>
        )}

        {/* Stat cards */}
        {statsQuery.isPending ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : statsQuery.data ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard title="Total Tickets" value={statsQuery.data.totalTickets.toLocaleString()} />
            <StatCard title="Open Tickets" value={statsQuery.data.openTickets.toLocaleString()} />
            <StatCard title="Resolved by AI" value={statsQuery.data.aiResolved.toLocaleString()} />
            <StatCard
              title="AI Resolution Rate"
              value={`${statsQuery.data.aiResolutionRate.toFixed(1)}%`}
            />
            <StatCard
              title="Avg Resolution Time"
              value={formatDuration(statsQuery.data.avgResolutionTimeMs)}
            />
          </div>
        ) : null}

        {/* Tickets per day chart */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Tickets per Day — Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartQuery.isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : chartData ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tickFormatter={tickFormatter}
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "6px",
                      fontSize: "13px",
                      color: "var(--color-foreground)",
                    }}
                    formatter={(value) => [value, "Tickets"]}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--color-primary)" />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
