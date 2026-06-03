import { NextResponse } from "next/server";
import { atList } from "@/lib/airtable";

export async function GET(): Promise<NextResponse> {
  const start = Date.now();
  let airtableStatus = "healthy";
  let airtableLatency = 0;
  let airtableError: string | undefined;

  try {
    const t = Date.now();
    await atList("conversations", { maxRecords: 1 });
    airtableLatency = Date.now() - t;
  } catch (e: any) {
    airtableStatus = "down";
    airtableError  = e.message;
  }

  const overall = airtableStatus === "healthy" ? "healthy" : "degraded";

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    overall,
    services: {
      airtable: { status: airtableStatus, latency_ms: airtableLatency, ...(airtableError ? { error: airtableError } : {}) },
      api:      { status: "healthy", latency_ms: Date.now() - start },
    },
    meta: { portal_url: "https://segguinee.vercel.app" },
  }, {
    status: overall === "healthy" ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
