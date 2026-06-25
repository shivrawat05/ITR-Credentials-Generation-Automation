"use client";

import {
  ArrowLeft,
  BellRinging,
  Pause,
  Play,
  Prohibit,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AutomationEvent, JobSummary } from "@itr/shared";
import {
  cancelJob,
  getEvents,
  getJob,
  streamEvents,
  submitOtp,
} from "../lib/api";
import { formatTime, PhasePill } from "./Format";

const phases = [
  "identity",
  "captcha",
  "otp_waiting",
  "otp_submitted",
  "password",
  "confirmation",
];

export function RunConsole({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobSummary | null>(null);
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [otp, setOtp] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const lastSeq = useMemo(
    () => events.reduce((max, event) => Math.max(max, event.seq ?? 0), 0),
    [events],
  );

  useEffect(() => {
    getJob(jobId)
      .then((result) => setJob(result.job))
      .catch(() => undefined);
    getEvents(jobId)
      .then((result) => setEvents(result.events))
      .catch(() => undefined);
  }, [jobId]);

  useEffect(() => {
    const controller = new AbortController();
    streamEvents(
      jobId,
      lastSeq,
      (event) => {
        setEvents((existing) =>
          existing.some((item) => item.seq === event.seq)
            ? existing
            : [...existing, event],
        );
        setJob((existing) =>
          existing
            ? { ...existing, phase: event.phase, updatedAt: event.timestamp }
            : existing,
        );
      },
      controller.signal,
    ).catch(() => undefined);
    return () => controller.abort();
  }, [jobId]);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events, paused]);

  async function sendOtp() {
    if (!otp) return;
    await submitOtp(jobId, otp);
    setOtp("");
  }

  async function cancel() {
    await cancelJob(jobId);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="toolbar">
          <Link className="button secondary" href="/" title="Back">
            <ArrowLeft size={18} />
          </Link>
          <div className="brand">
            <strong>Run {jobId.slice(-8)}</strong>
            <span>
              {job ? `${job.panMasked} · ${job.requestId}` : "Loading run"}
            </span>
          </div>
        </div>
        <div className="toolbar">
          {job ? <PhasePill phase={job.phase} /> : null}
          <button
            className="button secondary"
            onClick={() => setPaused((value) => !value)}
            title={paused ? "Resume auto-scroll" : "Pause auto-scroll"}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button className="button danger" onClick={cancel} title="Cancel run">
            <Prohibit size={18} />
          </button>
        </div>
      </header>
      <div className="content">
        <section className="panel">
          <div className="console-head">
            <div className="otp-row">
              <BellRinging size={20} />
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder="OTP"
                inputMode="numeric"
              />
              <button className="button" onClick={sendOtp}>
                Submit OTP
              </button>
            </div>
          </div>
          <div className="stepper">
            {phases.map((phase) => (
              <div
                key={phase}
                className={`step ${events.some((event) => event.phase === phase) ? "active" : ""}`}
                title={phase}
              />
            ))}
          </div>
          <div className="console">
            {events.map((event) => (
              <div
                key={`${event.jobId}-${event.seq}`}
                className={`log-line level-${event.level}`}
              >
                <span>{formatTime(event.timestamp)}</span>
                <span>{event.phase}</span>
                <span>
                  {event.step}: {event.message}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </section>
      </div>
    </main>
  );
}
