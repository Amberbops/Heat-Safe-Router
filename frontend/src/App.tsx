import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  service: string;
  message: string;
};

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/health`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setHealth(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Backend unavailable");
      } finally {
        setLoading(false);
      }
    };

    checkBackend();
  }, []);

  return (
    <main style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1>Heat-Safe Route Planner</h1>

      <p>
        Find walking routes that balance <strong>time, distance, and heat
        exposure</strong>.
      </p>

      <hr />

      <h2>AWS Backend</h2>

      {loading && <p>Connecting to AWS...</p>}

      {error && (
        <p>
          🔴 Backend connection failed: {error}
        </p>
      )}

      {health && (
        <div>
          <p>🟢 AWS backend connected</p>
          <p>
            <strong>Status:</strong> {health.status}
          </p>
          <p>
            <strong>Service:</strong> {health.service}
          </p>
          <p>
            <strong>Message:</strong> {health.message}
          </p>
        </div>
      )}
    </main>
  );
}

export default App;