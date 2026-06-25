"use client";

import { ArrowSquareOut, Play } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { JobOutcome, JobPhase, JobSummary } from "@itr/shared";
import { listJobs, startJob } from "../lib/api";
import { formatDuration, formatTime, OutcomePill, PhasePill } from "./Format";

export function RunTable() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [pan, setPan] = useState("");
  const [phase, setPhase] = useState("");
  const [outcome, setOutcome] = useState("");
  const [runHeaded, setRunHeaded] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (phase) params.set("phase", phase);
    if (outcome) params.set("outcome", outcome);
    return params.size ? `?${params.toString()}` : "";
  }, [phase, outcome]);

  useEffect(() => {
    const load = () =>
      listJobs(query)
        .then((result) => setJobs(result.jobs))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [query]);

  async function submit() {
    setError("");
    try {
      const result = await startJob(pan, runHeaded);
      window.location.href = `/runs/${result.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start run");
    }
  }

  return (
    <section className="panel">
      <div className="run-form">
        <div className="toolbar">
          <input
            value={pan}
            onChange={(event) => setPan(event.target.value.toUpperCase())}
            placeholder="PAN"
            maxLength={10}
          />
          <label className="toolbar muted">
            <input
              type="checkbox"
              checked={runHeaded}
              onChange={(event) => setRunHeaded(event.target.checked)}
            />
            Headed
          </label>
          <button className="button" onClick={submit} title="Start run">
            <Play size={18} /> Start
          </button>
        </div>
        <div className="filters">
          <select
            value={phase}
            onChange={(event) => setPhase(event.target.value)}
          >
            <option value="">All phases</option>
            {[
              "queued",
              "launching",
              "identity",
              "captcha",
              "otp_waiting",
              "password",
              "succeeded",
              "failed",
              "cancelled",
            ].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            <option value="">All outcomes</option>
            {["running", "success", "failure", "cancelled"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? <p className="muted">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Job</th>
            <th>PAN</th>
            <th>Phase</th>
            <th>Outcome</th>
            <th>Started</th>
            <th>Updated</th>
            <th>Duration</th>
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>{job.id.slice(-8)}</td>
              <td>{job.panMasked}</td>
              <td>
                <PhasePill phase={job.phase as JobPhase} />
              </td>
              <td>
                <OutcomePill outcome={job.outcome as JobOutcome} />
              </td>
              <td>{formatTime(job.startedAt)}</td>
              <td>{formatTime(job.updatedAt)}</td>
              <td>{formatDuration(job.durationMs)}</td>
              <td>
                <Link
                  className="button secondary"
                  href={`/runs/${job.id}`}
                  title="Open run"
                >
                  <ArrowSquareOut size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
