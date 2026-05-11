import { useEffect, useState } from "react";
import { Routes, Route } from "react-router";

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Helpdesk</h1>
    </div>
  );
}

type HealthData = {
  status: string;
  database: string;
  postgres: string;
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
        ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
      {label}
    </span>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="w-32 shrink-0 text-sm font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 font-mono break-all">{value}</span>
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">System Health</h1>
            <p className="text-sm text-gray-500 mt-0.5">Helpdesk · API + Database</p>
          </div>
          {!loading && (
            <StatusBadge ok={ok} label={ok ? "All systems operational" : "Degraded"} />
          )}
          {loading && (
            <span className="text-sm text-gray-400 animate-pulse">Checking…</span>
          )}
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
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
                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={check}
            disabled={loading}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Checking…" : "Re-check"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/health" element={<HealthPage />} />
    </Routes>
  );
}
