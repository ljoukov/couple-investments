import { ChartArea } from "@/components/chart-area";
import { ChartBar } from "@/components/chart-bar";
import { ChartPie } from "@/components/chart-pie";
import { Geist, Geist_Mono } from "next/font/google";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  return (
    <div className={`${geistSans.className} ${geistMono.className} min-h-screen bg-background text-foreground`}>
      <header className="border-b border-border py-4">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold">Couple Investments Dashboard</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="her" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="her">Her</TabsTrigger>
            <TabsTrigger value="him">Him</TabsTrigger>
          </TabsList>
          <TabsContent value="her">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartBar />
              <ChartArea />
              <ChartPie />
            </div>
          </TabsContent>
          <TabsContent value="him">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartBar />
              <ChartArea />
              <ChartPie />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
