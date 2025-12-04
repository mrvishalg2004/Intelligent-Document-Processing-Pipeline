import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
  Download,
  User,
  Building,
  MapPin,
  Calendar,
  Banknote,
} from "lucide-react";
import type { Document, Extraction, DocumentAnalysis, ExtractedEntity, ExtractedTable } from "@shared/schema";
import { format } from "date-fns";

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

function EntityIcon({ type }: { type: string }) {
  switch (type) {
    case "person":
      return <User className="w-4 h-4" />;
    case "organization":
      return <Building className="w-4 h-4" />;
    case "location":
      return <MapPin className="w-4 h-4" />;
    case "date":
      return <Calendar className="w-4 h-4" />;
    case "money":
      return <Banknote className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
}

function EntityBadgeColor(type: string) {
  switch (type) {
    case "person":
      return "bg-chart-1/10 text-chart-1 border-0";
    case "organization":
      return "bg-chart-2/10 text-chart-2 border-0";
    case "location":
      return "bg-chart-3/10 text-chart-3 border-0";
    case "date":
      return "bg-chart-4/10 text-chart-4 border-0";
    case "money":
      return "bg-chart-5/10 text-chart-5 border-0";
    default:
      return "";
  }
}

interface DocumentWithExtraction extends Document {
  extractions?: Extraction[];
  extractedText?: string;
}

export default function DocumentViewer() {
  const params = useParams<{ id: string }>();

  const { data: document, isLoading } = useQuery<DocumentWithExtraction>({
    queryKey: ["/api/documents", params.id],
    enabled: !!params.id,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const analysisExtraction = document?.extractions?.find(e => e.extractionType === "analysis");
  const analysis = analysisExtraction?.data as DocumentAnalysis | undefined;
  
  const tableExtraction = document?.extractions?.find(e => e.extractionType === "tables");
  const tables = (tableExtraction?.data as ExtractedTable[] | undefined) || analysis?.tables || [];

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-2">Document not found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          The document you're looking for doesn't exist or has been deleted
        </p>
        <Link href="/documents">
          <Button variant="outline">Back to Documents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/documents">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold" data-testid="text-document-name">
                {document.originalName}
              </h1>
              {getStatusBadge(document.status)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {formatFileSize(document.fileSize)} 
              {document.pageCount && ` • ${document.pageCount} pages`}
              {document.uploadDate && ` • Uploaded ${format(new Date(document.uploadDate), "MMM d, yyyy")}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/chat?document=${document.id}`}>
            <Button variant="outline" data-testid="button-ask-questions">
              <MessageSquare className="w-4 h-4 mr-2" />
              Ask Questions
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <Tabs defaultValue="text" className="w-full">
              <div className="border-b px-6 pt-4">
                <TabsList className="bg-transparent p-0 h-auto gap-4">
                  <TabsTrigger 
                    value="text" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-3"
                  >
                    Extracted Text
                  </TabsTrigger>
                  <TabsTrigger 
                    value="entities"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-3"
                  >
                    Entities
                  </TabsTrigger>
                  <TabsTrigger 
                    value="tables"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-3"
                  >
                    Tables
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="text" className="mt-0">
                <ScrollArea className="h-[500px] p-6">
                  {document.status === "processing" ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                      <p className="text-muted-foreground">Processing document...</p>
                    </div>
                  ) : document.extractedText ? (
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed"
                      data-testid="text-extracted-content"
                    >
                      {document.extractedText}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No text extracted yet</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="entities" className="mt-0">
                <ScrollArea className="h-[500px] p-6">
                  {analysis?.entities ? (
                    <div className="space-y-4">
                      {[
                        { key: 'persons', label: 'person', icon: 'person' },
                        { key: 'organizations', label: 'organization', icon: 'organization' },
                        { key: 'locations', label: 'location', icon: 'location' },
                        { key: 'dates', label: 'date', icon: 'date' },
                        { key: 'money', label: 'money', icon: 'money' },
                        { key: 'emails', label: 'email', icon: 'other' },
                        { key: 'phones', label: 'phone', icon: 'other' }
                      ].map(({ key, label, icon }) => {
                        const items = analysis.entities[key as keyof typeof analysis.entities] || [];
                        if (!Array.isArray(items) || items.length === 0) return null;
                        
                        return (
                          <div key={key}>
                            <h4 className="text-sm font-medium capitalize mb-2 flex items-center gap-2">
                              <EntityIcon type={icon} />
                              {label}s ({items.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {items.map((text: string, index: number) => (
                                <Badge 
                                  key={index} 
                                  variant="secondary"
                                  className={EntityBadgeColor(icon)}
                                >
                                  {text}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <User className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No entities extracted yet</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="tables" className="mt-0">
                <ScrollArea className="h-[500px] p-6">
                  {tables && tables.length > 0 ? (
                    <div className="space-y-6">
                      {tables.map((table, tableIndex) => (
                        <div key={tableIndex}>
                          <h4 className="text-sm font-medium mb-3">Table {tableIndex + 1}</h4>
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {table.headers.map((header, i) => (
                                    <TableHead key={i} className="font-medium">
                                      {header}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {table.rows.map((row, rowIndex) => (
                                  <TableRow key={rowIndex}>
                                    {row.map((cell, cellIndex) => (
                                      <TableCell key={cellIndex}>{cell}</TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No tables found in this document</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Document Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(document.status)}
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Size</span>
                <span className="text-sm font-medium">{formatFileSize(document.fileSize)}</span>
              </div>
              {document.pageCount && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pages</span>
                  <span className="text-sm font-medium">{document.pageCount}</span>
                </div>
              )}
              {document.uploadDate && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Uploaded</span>
                  <span className="text-sm font-medium">
                    {format(new Date(document.uploadDate), "MMM d, yyyy")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {analysis && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {analysis.summary || "No summary available"}
                  </p>
                </CardContent>
              </Card>

              {analysis.keywords && analysis.keywords.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-medium">Keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Words</span>
                    <span className="text-sm font-medium">
                      {analysis.wordCount?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Characters</span>
                    <span className="text-sm font-medium">
                      {analysis.characterCount?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Entities</span>
                    <span className="text-sm font-medium">{analysis.entities?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tables</span>
                    <span className="text-sm font-medium">{analysis.tables?.length || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
