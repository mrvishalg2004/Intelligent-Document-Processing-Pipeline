import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  generateDocumentSummary,
  extractKeywords,
  isGeminiConfigured,
  generateChatResponse,
} from "./gemini";
import {
  extractEntities,
  extractTablesFromText,
  getTextStatistics,
  extractKeywordsFromText,
} from "./nlp";
import type { DocumentAnalysis } from "@shared/mongo-schema";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  // Health check endpoint for database connection
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      await db.admin().ping();
      const stats = await db.stats();
      res.json({
        status: "healthy",
        database: {
          connected: true,
          name: db.databaseName,
          collections: stats.collections,
          dataSize: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`,
          indexSize: `${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        database: { connected: false },
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get(
    "/api/dashboard/stats",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const userId = req.user.claims.sub;
        const stats = await storage.getDashboardStats(userId);
        res.json(stats);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: "Failed to fetch dashboard stats" });
      }
    }
  );

  app.get("/api/documents", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string | undefined;

      const docs =
        query ?
          await storage.searchDocuments(userId, query) :
          await storage.getDocuments(userId);

      res.json(docs);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get(
    "/api/documents/:id",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const doc = await storage.getDocumentWithExtractions(req.params.id);
        if (!doc) {
          return res.status(404).json({ message: "Document not found" });
        }

        if (doc.userId !== req.user.claims.sub) {
          return res.status(403).json({ message: "Access denied" });
        }

        res.json(doc);
      } catch (error) {
        console.error("Error fetching document:", error);
        res.status(500).json({ message: "Failed to fetch document" });
      }
    }
  );

  app.post(
    "/api/documents/upload",
    isAuthenticated,
    upload.single("file"),
    async (req: any, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const userId = req.user.claims.sub;
        const file = req.file;

        const doc = await storage.createDocument({
          userId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          status: "processing",
        });

        processDocument((doc as any)._id, file.path).catch((error) => {
          console.error(`Error processing document ${(doc as any)._id}:`, error);
          storage.updateDocument((doc as any)._id, { status: "error" });
        });

        res.json(doc);
      } catch (error) {
        console.error("Error uploading document:", error);
        res.status(500).json({ message: "Failed to upload document" });
      }
    }
  );

  app.delete(
    "/api/documents/:id",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const doc = await storage.getDocument(req.params.id);
        if (!doc) {
          return res.status(404).json({ message: "Document not found" });
        }

        if (doc.userId !== req.user.claims.sub) {
          return res.status(403).json({ message: "Access denied" });
        }

        const filePath = path.join(uploadDir, doc.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        await storage.deleteDocument(req.params.id);
        res.json({ message: "Document deleted" });
      } catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).json({ message: "Failed to delete document" });
      }
    }
  );

  app.get(
    "/api/chat/:documentId",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const doc = await storage.getDocument(req.params.documentId);
        if (!doc) {
          return res.status(404).json({ message: "Document not found" });
        }

        if (doc.userId !== req.user.claims.sub) {
          return res.status(403).json({ message: "Access denied" });
        }

        const messages = await storage.getChatMessages(req.params.documentId);
        res.json(messages);
      } catch (error) {
        console.error("Error fetching chat messages:", error);
        res.status(500).json({ message: "Failed to fetch chat messages" });
      }
    }
  );

  app.post("/api/chat", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { documentId, content } = req.body;
      const userId = req.user.claims.sub;

      if (!documentId || !content) {
        return res.status(400).json({ message: "Missing documentId or content" });
      }

      const doc = await storage.getDocumentWithExtractions(documentId);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (doc.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.createChatMessage({
        documentId,
        userId,
        role: "user",
        content,
      });

      const chatHistory = await storage.getChatMessages(documentId);
      const historyForAI = chatHistory.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      let aiResponse: string;
      let citations: string[] = [];
      
      try {
        if (!isGeminiConfigured()) {
          aiResponse = "AI chat is not configured. Please set up GEMINI_API_KEY.";
        } else {
          aiResponse = await generateChatResponse(
            doc.extractedText || "No text extracted from document.",
            content,
            historyForAI
          );
        }
      } catch (aiError) {
        console.error("AI error:", aiError);
        // Provide a more helpful fallback response with citations
        if (doc.extractedText && doc.extractedText.length > 0) {
          // Simple keyword-based response with relevant document sections
          const searchTerm = content.toLowerCase();
          const textLower = doc.extractedText.toLowerCase();
          
          if (textLower.includes(searchTerm)) {
            const sentences = doc.extractedText.split(/[.!?]+/).filter(s => 
              s.toLowerCase().includes(searchTerm) && s.trim().length > 20
            );
            
            if (sentences.length > 0) {
              const relevantSentences = sentences.slice(0, 3);
              citations = relevantSentences.map(s => s.trim());
              
              aiResponse = `Based on the document, here's what I found:\n\n${relevantSentences.join('. ')}.\n\n**Sources**\n${citations.map((c, i) => `[${i + 1}] ${c}`).join('\n')}`;
            } else {
              aiResponse = "I found your search term in the document, but couldn't extract a clear answer. Please try rephrasing your question.";
            }
          } else {
            aiResponse = "I couldn't find relevant information about that in the document. Try asking about the main topics or specific terms from the document.";
          }
        } else {
          aiResponse = "I'm sorry, I couldn't process your question. The document text may not have been extracted properly.";
        }
      }

      const assistantMessage = await storage.createChatMessage({
        documentId,
        userId,
        role: "assistant",
        content: aiResponse,
        citations: citations.length > 0 ? citations : undefined,
      });

      res.json(assistantMessage);
    } catch (error) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/reports", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const reports = await storage.getReportsData(userId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  (async () => {
    try {
      console.log("Checking for documents stuck in 'processing' state...");
      // Get all documents and filter stuck ones (processing for more than 10 minutes)
      const allDocs = await storage.getDocuments("mock-user-id-123");
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const stuckDocuments = allDocs.filter(
        (doc) => doc.status === "processing" && new Date(doc.uploadDate) < tenMinutesAgo
      );

      if (stuckDocuments.length > 0) {
        console.log(
          `Found ${stuckDocuments.length} stuck document(s). Restarting processing...`
        );

        for (const doc of stuckDocuments) {
          try {
            const docId = (doc as any)._id?.toString();

            if (!docId) {
              console.error(
                `- Reprocessing failed: Document with original name '${doc.originalName}' has no ID.`
              );
              continue;
            }

            const filePath = path.join(uploadDir, doc.filename);
            if (fs.existsSync(filePath)) {
              console.log(`- Reprocessing: ${doc.originalName} (ID: ${docId})`);
              await processDocument(docId, filePath);
            } else {
              console.warn(
                `- File not found for document ${docId}. Marking as error.`
              );
              await storage.updateDocument(docId, { status: "error" });
            }
          } catch (error) {
            console.error(
              `Error reprocessing document ${(doc as any).id}:`,error
            );
          }
        }

        console.log("Finished reprocessing stuck documents.");
      } else {
        console.log("No stuck documents found. System is clean.");
      }
    } catch (error) {
      console.error(
        "Error during startup reprocessing of stuck documents:",
        error
      );
    }
  })();

  const httpServer = createServer(app);
  return httpServer;
}

async function processDocument(
  documentId: string,
  filePath: string
): Promise<void> {
  console.log(`Starting to process document ${documentId} at path ${filePath}`);
  try {
    await storage.updateDocument(documentId, {
      status: "processing",
      processingProgress: 10,
    });
    console.log(`[${documentId}] Parsing PDF...`);
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);
    await storage.updateDocument(documentId, { processingProgress: 25 });
    console.log(`[${documentId}] PDF parsed successfully.`);

    const text = pdfData.text || "";
    const pageCount = pdfData.numpages || 1;

    console.log(`[${documentId}] Saving extracted text...`);
    await storage.createPage({
      documentId,
      pageNumber: 1,
      extractedText: text,
      ocrConfidence: 1.0,
    });
    await storage.updateDocument(documentId, { processingProgress: 40 });
    console.log(`[${documentId}] Extracted text saved.`);

    console.log(`[${documentId}] Running NLP tasks...`);
    const [entities, nlpKeywords, tables, stats] = await Promise.all([
      Promise.resolve(extractEntities(text)).catch((e) => {
        console.error(`[${documentId}] Error in extractEntities`, e);
        return [];
      }),
      Promise.resolve(extractKeywordsFromText(text)).catch((e) => {
        console.error(`[${documentId}] Error in extractKeywordsFromText`, e);
        return [];
      }),
      Promise.resolve(extractTablesFromText(text)).catch((e) => {
        console.error(`[${documentId}] Error in extractTablesFromText`, e);
        return [];
      }),
      Promise.resolve(getTextStatistics(text)).catch((e) => {
        console.error(`[${documentId}] Error in getTextStatistics`, e);
        return { wordCount: 0, characterCount: 0 };
      }),
    ]);
    await storage.updateDocument(documentId, { processingProgress: 60 });
    console.log(`[${documentId}] NLP tasks completed.`);

    const sentences = text
      .split(/[.!?]+/)
      .filter((s: string) => s.trim().length > 20)
      .slice(0, 3);
    const summary =
      sentences.join(". ") + (sentences.length > 0 ? "." : "No summary available.");

    // Group entities by type
    const groupedEntities = {
      persons: Array.isArray(entities) ? entities.filter(e => e.type === 'person').map(e => e.text) : [],
      organizations: Array.isArray(entities) ? entities.filter(e => e.type === 'organization').map(e => e.text) : [],
      locations: Array.isArray(entities) ? entities.filter(e => e.type === 'location').map(e => e.text) : [],
      dates: Array.isArray(entities) ? entities.filter(e => e.type === 'date').map(e => e.text) : [],
      money: Array.isArray(entities) ? entities.filter(e => e.type === 'money').map(e => e.text) : [],
      emails: Array.isArray(entities) ? entities.filter(e => e.type === 'email').map(e => e.text) : [],
      phones: Array.isArray(entities) ? entities.filter(e => e.type === 'phone').map(e => e.text) : [],
    };

    const analysis: DocumentAnalysis = {
      summary,
      keywords: nlpKeywords.slice(0, 15),
      entities: groupedEntities,
      tables,
      statistics: {
        wordCount: stats.wordCount,
        charCount: stats.characterCount,
        sentenceCount: (stats as any).sentenceCount || 0,
        paragraphCount: (stats as any).paragraphCount || 0,
        avgWordsPerSentence: (stats as any).avgWordsPerSentence || 0,
        readingTime: Math.ceil(stats.wordCount / 200) || 1,
      },
    };

    console.log(`[${documentId}] Saving analysis...`);
    await storage.createExtraction({
      documentId,
      extractionType: "analysis",
      data: analysis,
    });
    await storage.updateDocument(documentId, { processingProgress: 80 });
    console.log(`[${documentId}] Analysis saved.`);

    if (isGeminiConfigured()) {
      console.log(`[${documentId}] Enhancing with AI (non-blocking)...`);
      // Run AI enhancement in background (non-blocking)
      enhanceAnalysisWithAI(documentId, text).catch((error) => {
        console.error(`[${documentId}] AI enhancement failed:`, error);
      });
      await storage.updateDocument(documentId, { processingProgress: 90 });
    }

    await storage.updateDocument(documentId, {
      status: "completed",
      processedAt: new Date(),
      pageCount,
      processingProgress: 100,
      extractedText: text.slice(0, 50000), // Store first 50KB of text for quick access
    });
    console.log(`[${documentId}] Processing complete.`);
  } catch (error) {
    console.error(`[${documentId}] Error processing document:`, error);
    await storage.updateDocument(documentId, {
      status: "error",
      processingProgress: -1,
    });
    throw error;
  }
}

async function enhanceAnalysisWithAI(
  documentId: string,
  text: string
): Promise<void> {
  try {
    const [summary, aiKeywords] = await Promise.all([
      generateDocumentSummary(text),
      extractKeywords(text),
    ]);

    const existingExtraction = await storage.getExtraction(
      documentId,
      "analysis"
    );
    if (existingExtraction) {
      const analysis = existingExtraction.data as DocumentAnalysis;
      analysis.summary = summary;
      analysis.keywords = Array.from(
        new Set([...aiKeywords, ...analysis.keywords])
      ).slice(0, 15);
      await storage.updateExtraction((existingExtraction as any)._id, analysis);
    }
  } catch (error) {
    console.error(`[${documentId}] AI enhancement failed:`, error);
  }
}
