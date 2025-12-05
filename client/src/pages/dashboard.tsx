import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Upload, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Brain,
  MessageSquare,
  Loader2,
} from "lucide-react";
import type { Document } from "@shared/mongo-schema";
import { format } from "date-fns";

interface DashboardStats {
  totalDocuments: number;
  processingCount: number;
  completedCount: number;
  errorCount: number;
  recentDocuments: Document[];
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  loading 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
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
            {trend && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-chart-2" />
                {trend}
              </p>
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

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 border-0">Completed</Badge>;
    case "processing":
      return (
        <Badge variant="secondary" className="bg-chart-4/10 text-chart-4 border-0">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Processing
        </Badge>
      );
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your document processing activity
          </p>
        </div>
        <Link href="/upload">
          <Button data-testid="button-upload-new">
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Documents"
          value={stats?.totalDocuments ?? 0}
          icon={FileText}
          loading={isLoading}
        />
        <StatCard
          title="Processing"
          value={stats?.processingCount ?? 0}
          icon={Clock}
          loading={isLoading}
        />
        <StatCard
          title="Completed"
          value={stats?.completedCount ?? 0}
          icon={CheckCircle2}
          loading={isLoading}
        />
        <StatCard
          title="Errors"
          value={stats?.errorCount ?? 0}
          icon={AlertCircle}
          loading={isLoading}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg font-medium">Recent Documents</CardTitle>
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : stats?.recentDocuments && stats.recentDocuments.length > 0 ? (
              <div className="space-y-3">
                {stats.recentDocuments.map((doc) => (
                  <Link key={doc.id} href={`/documents/${doc.id}`}>
                    <div 
                      className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover-elevate cursor-pointer transition-all"
                      data-testid={`document-card-${doc.id}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.originalName}</p>
                        <p className="text-sm text-muted-foreground">
                          {doc.uploadDate && format(new Date(doc.uploadDate), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-2">No documents yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your first PDF to get started
                </p>
                <Link href="/upload">
                  <Button size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/upload">
              <Button variant="outline" className="w-full justify-start" data-testid="quick-action-upload">
                <Upload className="w-4 h-4 mr-3" />
                Upload New Document
              </Button>
            </Link>
            <Link href="/documents">
              <Button variant="outline" className="w-full justify-start" data-testid="quick-action-chat">
                <MessageSquare className="w-4 h-4 mr-3" />
                Ask Questions
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="outline" className="w-full justify-start" data-testid="quick-action-reports">
                <Brain className="w-4 h-4 mr-3" />
                View Reports
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
