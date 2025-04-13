import { ChartArea } from "@/components/chart-area";
import { ChartBar } from "@/components/chart-bar";
import { ChartLine } from "@/components/chart-line";
import { ChartPie } from "@/components/chart-pie";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border py-4">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold">Couple Investments Dashboard</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartLine />
          <ChartBar />
          <ChartArea />
          <ChartPie />
        </div>
      </main>
    </div>
  );
}
