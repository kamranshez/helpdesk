import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router";
import { authClient } from "./lib/auth-client";
import LoginPage from "./pages/LoginPage";
import Navbar from "./components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function Home() {
  const { data: session } = authClient.useSession();

  return (
    <div className="min-h-screen bg-background">
      <Navbar userName={session?.user.name ?? ""} />
      <div className="p-8">
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
      </div>
    </div>
  );
}

type HealthData = {
  status: string;
  database: string;
  postgres: string;
};

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <span className="w-32 shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-mono break-all">{value}</span>
    </div>
  );
}

function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function check() {
    setLoading(true);
    setError(null);
    setData(null);
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d: HealthData) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { check(); }, []);

  const ok = !!data && data.status === "ok";

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>System Health</CardTitle>
            <CardDescription className="mt-0.5">Helpdesk · API + Database</CardDescription>
          </div>
          {!loading && (
            <Badge variant={ok ? "default" : "destructive"}>
              {ok ? "All systems operational" : "Degraded"}
            </Badge>
          )}
          {loading && (
            <span className="text-sm text-muted-foreground animate-pulse">Checking…</span>
          )}
        </CardHeader>

        <CardContent className="pt-4">
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              <strong>Error:</strong> {error}
            </div>
          )}
          {data && (
            <div>
              <HealthRow label="API server" value={data.status} />
              <HealthRow label="Database" value={data.database} />
              <HealthRow label="PostgreSQL" value={data.postgres} />
            </div>
          )}
          {loading && (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-muted rounded animate-pulse" />
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border">
            <Button variant="ghost" size="sm" onClick={check} disabled={loading}>
              {loading ? "Checking…" : "Re-check"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route path="/health" element={<HealthPage />} />
    </Routes>
  );
}
