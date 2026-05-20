import { useQuery } from "@tanstack/react-query";
import { AlertCircle, TrendingUp, Inbox, Zap, Clock, BarChart2 } from "lucide-react";
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

function greeting(name: string): string {
  const h = new Date().getHours();
  const first = name.split(" ")[0];
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

type StatCardProps = {
  title: string;
  value: string;
  icon: React.ElementType;
  accent?: boolean;
};

function StatCard({ title, value, icon: Icon, accent }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-semibold text-foreground tabular-nums">{value}</p>
          </div>
          <div className={[
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          ].join(" ")}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const userName = session?.user.name ?? "";

  const statsQuery = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });

  const chartQuery = useQuery<TicketsPerDayPoint[]>({
    queryKey: ["stats", "tickets-per-day"],
    queryFn: fetchTicketsPerDay,
  });

  const chartData = chartQuery.data?.map((p) => ({ ...p, label: formatDateLabel(p.date) }));

  const tickFormatter = (label: string, index: number) =>
    index % 5 === 0 ? label : "";

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={userName} />
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-normal text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {greeting(userName)}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what's happening with your support queue today.
          </p>
        </div>

        {(statsQuery.isError || chartQuery.isError) && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load dashboard data. Please try again.</AlertDescription>
          </Alert>
        )}

        {/* Stat cards */}
        {statsQuery.isPending ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : statsQuery.data ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard title="Total Tickets" value={statsQuery.data.totalTickets.toLocaleString()} icon={Inbox} />
            <StatCard title="Open Tickets" value={statsQuery.data.openTickets.toLocaleString()} icon={TrendingUp} accent />
            <StatCard title="Resolved by AI" value={statsQuery.data.aiResolved.toLocaleString()} icon={Zap} />
            <StatCard
              title="AI Resolution Rate"
              value={`${statsQuery.data.aiResolutionRate.toFixed(1)}%`}
              icon={BarChart2}
              accent
            />
            <StatCard
              title="Avg Resolution Time"
              value={formatDuration(statsQuery.data.avgResolutionTimeMs)}
              icon={Clock}
            />
          </div>
        ) : null}

        {/* Chart */}
        <Card className="mt-6">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-medium text-foreground">
              Tickets per Day
            </CardTitle>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardHeader>
          <CardContent className="pt-4">
            {chartQuery.isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : chartData ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="35%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tickFormatter={tickFormatter}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "var(--color-foreground)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                    formatter={(value) => [value, "Tickets"]}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-primary)" />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
