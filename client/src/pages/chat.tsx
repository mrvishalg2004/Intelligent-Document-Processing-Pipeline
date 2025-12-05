import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { 
  Send, 
  FileText, 
  MessageSquare,
  Bot,
  User,
  Loader2,
  Sparkles,
  ArrowLeft,
  Quote,
} from "lucide-react";
import type { Document, ChatMessage } from "@shared/mongo-schema";
import { format } from "date-fns";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const exampleQuestions = [
  "What is the main topic of this document?",
  "Summarize the key points mentioned",
  "What are the important dates or deadlines?",
  "List all the people mentioned",
  "What organizations are referenced?",
];

const ChatMessageContent = ({ content }: { content: string }) => {
  const parts = content.split("**Sources**");
  const mainContent = parts[0];
  const sourcesRaw = parts[1];

  const sources = sourcesRaw?.split(/\n\[\d+\]/).slice(1).map((s, i) => ({
    number: i + 1,
    text: s.trim().replace(/^\s*-\s*/, ""),
  }));

  return (
    <div>
      <Markdown 
        remarkPlugins={[remarkGfm]} 
        components={{
          div: ({node, ...props}) => <div className="prose prose-sm dark:prose-invert max-w-none" {...props} />
        }}
      >
        {mainContent}
      </Markdown>
      {sources && sources.length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold mb-2 text-xs uppercase tracking-wider">Sources</h4>
          <div className="space-y-2">
            {sources.map((source) => (
              <div key={source.number} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border">
                <div className="w-5 h-5 flex-shrink-0 text-xs flex items-center justify-center rounded-full bg-muted-foreground/20 font-semibold">
                  {source.number}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  \"{source.text}\"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function Chat() {
  const [, params] = useRoute("/chat/:id");
  const documentId = params?.id;

  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: document, isLoading: documentLoading } = useQuery<Document>({
    queryKey: ["/api/documents", documentId],
    enabled: !!documentId,
  });

  const { data: chatMessages, isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", documentId],
    enabled: !!documentId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!documentId) throw new Error("No document ID");
      return await apiRequest("POST", "/api/chat", {
        documentId,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", documentId] });
      setMessage("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, sendMessageMutation.isPending]);

  const handleSend = () => {
    if (!message.trim() || !documentId || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExampleQuestion = (question: string) => {
    setMessage(question);
  };
  
  if (documentLoading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
  }

  if (!document) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-2">Document not found</h3>
        <p className="text-sm text-muted-foreground mb-4">We couldn't find the document you're looking for.</p>
        <Link href="/documents">
          <Button variant="outline">Back to Documents</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center gap-3">
            <Link href="/documents">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg truncate max-w-[calc(100vw-30rem)]">Q&A: {document.originalName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ask questions about your document
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-6">
            {messagesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : chatMessages && chatMessages.length > 0 ? (
              <div className="space-y-6">
                {chatMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                    data-testid={`chat-message-${msg.id}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                    <div className={`
                      max-w-[75%] rounded-2xl p-4
                      ${msg.role === "user" 
                        ? "bg-primary text-primary-foreground ml-auto" 
                        : "bg-muted"
                      }
                    `}>
                      {msg.role === "assistant" ? (
                        <ChatMessageContent content={msg.content} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      )}
                      <p className={`text-xs mt-2 ${
                        msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}>
                        {msg.createdAt && format(new Date(msg.createdAt), "h:mm a")}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
                {sendMessageMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-2xl p-4">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="text-center py-8">
                <h4 className="font-medium mb-3">Start a conversation</h4>
                <p className="text-sm text-muted-foreground mb-6">
                  Ask anything about your document. Here are some ideas:
                </p>
                <div className="space-y-2">
                  {exampleQuestions.slice(0, 3).map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4"
                      onClick={() => handleExampleQuestion(question)}
                    >
                      <Sparkles className="w-4 h-4 mr-3 text-primary flex-shrink-0" />
                      <span className="text-sm">{question}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-4">
            <div className="relative">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about this document..."
                className="min-h-[60px] resize-none pr-20"
                disabled={sendMessageMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMessageMutation.isPending}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 px-4"
                data-testid="button-send-message"
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-96 hidden xl:flex flex-col flex-shrink-0">
        <CardHeader className="border-b">
          <CardTitle className="text-base font-medium">Example Questions</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {exampleQuestions.map((question, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full justify-start text-left h-auto py-3 px-3 hover-elevate"
                onClick={() => handleExampleQuestion(question)}
              >
                <span className="text-sm text-muted-foreground">{question}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
