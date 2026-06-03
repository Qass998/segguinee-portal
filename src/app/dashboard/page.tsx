import { Suspense } from "react";
import { DashboardContent } from "@/app/dashboard-client";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
