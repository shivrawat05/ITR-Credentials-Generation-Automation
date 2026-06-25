import { RunConsole } from "../../../components/RunConsole";

export default async function RunPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <RunConsole jobId={jobId} />;
}
