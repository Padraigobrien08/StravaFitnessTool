import { OperationalDashboard, OpsWeekRow, OpsIntelRow } from "./operational-dashboard";
import { DashboardPanel } from "./dashboard-panel";

function Bone({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className ?? ""}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-enter w-full pb-8">
      <OperationalDashboard>
        <Bone className="mb-4 h-10 w-full" />
        <Bone className="h-40 w-full" />
        <OpsIntelRow>
          <div className="lg:col-span-7 xl:col-span-8">
            <DashboardPanel className="min-h-[280px]">
              <Bone className="h-full min-h-[240px]" />
            </DashboardPanel>
          </div>
          <div className="lg:col-span-5 xl:col-span-4">
            <DashboardPanel className="min-h-[280px]">
              <Bone className="h-full min-h-[240px]" />
            </DashboardPanel>
          </div>
        </OpsIntelRow>
        <OpsWeekRow>
          <Bone className="h-36" />
          <Bone className="h-36" />
        </OpsWeekRow>
        <Bone className="h-16 w-full" />
        <Bone className="h-6 w-full" />
      </OperationalDashboard>
    </div>
  );
}
