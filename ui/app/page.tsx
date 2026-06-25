import { MetricsStrip } from "../components/MetricsStrip";
import { RunTable } from "../components/RunTable";

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>ITR Credentials Operations</strong>
          <span>RegisterKaro automation dashboard</span>
        </div>
      </header>
      <div className="content">
        <MetricsStrip />
        <RunTable />
      </div>
    </main>
  );
}
