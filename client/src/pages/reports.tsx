import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement,
  PointElement,
  ArcElement,
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { 
  FileText, 
  Brain,
  TrendingUp,
  FileDown
} from "lucide-react";
import type { ReportsData } from "@shared/mongo-schema";
import { exportToPdf, exportToWord } from '@/lib/exporter';
import { useRef } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function StatCard({ 
  title, 
  value, 
  icon: Icon,
  loading 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">{title}</p>
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-3xl font-bold">{value}</p>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { data: reports, isLoading } = useQuery<ReportsData>({
    queryKey: ["/api/reports"],
  });

  const charts = {
    documentsOverTime: useRef<ChartJS>(null),
    entityDistribution: useRef<ChartJS>(null),
    topKeywords: useRef<ChartJS>(null),
    statusDistribution: useRef<ChartJS>(null),
  }

  const documentsOverTimeData = {
    labels: reports?.documentsOverTime?.map(d => d.date) || [],
    datasets: [
      {
        label: 'Documents',
        data: reports?.documentsOverTime?.map(d => d.count) || [],
        borderColor: 'hsl(var(--primary))',
        backgroundColor: 'hsl(var(--primary))',
      },
    ],
  };

  const entityDistributionData = {
    labels: reports?.entityDistribution?.map(e => e.name) || [],
    datasets: [
      {
        data: reports?.entityDistribution?.map(e => e.value) || [],
        backgroundColor: [
          'hsl(var(--chart-1))',
          'hsl(var(--chart-2))',
          'hsl(var(--chart-3))',
          'hsl(var(--chart-4))',
          'hsl(var(--chart-5))',
        ],
      },
    ],
  };

  const topKeywordsData = {
    labels: reports?.topKeywords?.slice(0, 8).map(k => k.keyword) || [],
    datasets: [
      {
        label: 'Count',
        data: reports?.topKeywords?.slice(0, 8).map(k => k.count) || [],
        backgroundColor: 'hsl(var(--primary))',
      },
    ],
  };

  const statusDistributionData = {
    labels: reports?.statusDistribution?.map(s => s.status) || [],
    datasets: [
      {
        label: 'Count',
        data: reports?.statusDistribution?.map(s => s.count) || [],
        backgroundColor: 'hsl(var(--chart-2))',
      },
    ],
  };

  const chartOptions = (title: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title,
      },
    },
  });
  
  const handleExport = (format: 'pdf' | 'word') => {
    if (!reports) return;

    const chartInstances = {
      documentsOverTime: charts.documentsOverTime.current,
      entityDistribution: charts.entityDistribution.current,
      topKeywords: charts.topKeywords.current,
      statusDistribution: charts.statusDistribution.current,
    };

    if (format === 'pdf') {
      exportToPdf(reports, chartInstances);
    } else {
      exportToWord(reports, chartInstances);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-start sm:space-y-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-reports-title">
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Visual insights from your processed documents
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => handleExport('word')}>
            <FileDown className="w-4 h-4 mr-2" />
            Export Word
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Documents" value={reports?.totalDocuments?.toLocaleString() ?? 0} icon={FileText} loading={isLoading} />
        <StatCard title="Total Pages" value={reports?.totalPages?.toLocaleString() ?? 0} icon={Brain} loading={isLoading} />
        <StatCard title="Total Words" value={reports?.totalWords?.toLocaleString() ?? 0} icon={TrendingUp} loading={isLoading} />
        <StatCard title="Avg Words/Doc" value={reports?.totalDocuments && reports?.totalWords ? Math.round(reports.totalWords / reports.totalDocuments).toLocaleString() : 0} icon={FileText} loading={isLoading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Documents Over Time</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? <Skeleton className="h-full w-full" /> : <Line ref={charts.documentsOverTime} options={chartOptions('Documents Over Time')} data={documentsOverTimeData} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Entity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? <Skeleton className="h-full w-full" /> : <Pie ref={charts.entityDistribution} options={chartOptions('Entity Distribution')} data={entityDistributionData} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Top Keywords</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? <Skeleton className="h-full w-full" /> : <Bar ref={charts.topKeywords} options={{ ...chartOptions('Top Keywords'), indexAxis: 'y' as const }} data={topKeywordsData} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Document Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? <Skeleton className="h-full w-full" /> : <Bar ref={charts.statusDistribution} options={chartOptions('Document Status')} data={statusDistributionData} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
