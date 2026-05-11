import { useEffect, useState } from "react";
import { Routes, Route } from "react-router";

function Home() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Helpdesk</h1>
      {error && <p className="text-red-500">Server unreachable</p>}
      {status && <p className="text-green-600">Server status: {status}</p>}
      {!status && !error && <p className="text-gray-400">Checking server...</p>}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
