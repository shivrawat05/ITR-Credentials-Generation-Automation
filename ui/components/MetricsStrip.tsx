"use client";

import { useEffect, useState } from "react";
import { getMetrics } from "../lib/api";
import { formatDuration } from "./Format";

type Metrics = Awaited<ReturnType<typeof getMetrics>>;

export function MetricsStrip() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const load = () =>
      getMetrics()
        .then(setMetrics)
        .catch(() => undefined);
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const data = metrics ?? {
    totalRuns: 0,
    successRate: 0,
    failures: 0,
    p50DurationMs: 0,
    p99DurationMs: 0,
  };

  return (
    <section className="metrics">
      <div className="metric">
        <span>Total runs</span>
        <strong>{data.totalRuns}</strong>
      </div>
      <div className="metric">
        <span>Success rate</span>
        <strong>{Math.round(data.successRate * 100)}%</strong>
      </div>
      <div className="metric">
        <span>Failures</span>
        <strong>{data.failures}</strong>
      </div>
      <div className="metric">
        <span>p50 duration</span>
        <strong>{formatDuration(data.p50DurationMs)}</strong>
      </div>
      <div className="metric">
        <span>p99 duration</span>
        <strong>{formatDuration(data.p99DurationMs)}</strong>
      </div>
    </section>
  );
}
