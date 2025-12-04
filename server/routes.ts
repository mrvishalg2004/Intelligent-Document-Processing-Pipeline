
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateChatResponse } from "./openai";
import { generateDocumentSummary, extractKeywords, isGeminiConfigured } from "./gemini";
import { extractEntities, extractTablesFromText, getTextStatistics, extractKeywordsFromText } from "./nlp";
import type { DocumentAnalysis } from "@shared/schema";

// Use createRequire for CommonJS module (pdf-parse)
const require = createRequire(import.meta.url);

// pdf-parse is a simple function that takes a buffer
const pdfParse = require("pdf-parse");

// Configure multer for file uploads
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
  // Set up authentication
  await setupAuth(app);

  // Auth routes
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

  // Dashboard stats
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Document routes
  app.get("/api/documents", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string | undefined;
      
      const docs = query 
        ? await storage.searchDocuments(userId, query)
        : await storage.getDocuments(userId);
      
      res.json(docs);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const docId = req.params.id;
      
      // Validate document ID
      if (!docId || docId === 'undefined' || docId === 'null') {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const doc = await storage.getDocumentWithExtractions(docId);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check ownership
      if (doc.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(doc);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // File upload
  app.post("/api/documents/upload", isAuthenticated, upload.single("file"), async (req: any, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const file = req.file;

      // Create document record
      const doc = await storage.createDocument({
        userId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: "processing",
      });

      // Process the PDF asynchronously
      processDocument(doc._id, file.path).catch((error) => {
        console.error("Error processing document:", error);
        storage.updateDocument(doc._id, { status: "error" });
      });

      res.json(doc);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.delete("/api/documents/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (doc.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete file from disk
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
  });

  // Retry/reprocess failed document
  app.post("/api/documents/:id/retry", isAuthenticated, async (req: any, res: Response) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (doc.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if file exists
      const filePath = path.join(uploadDir, doc.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Document file not found" });
      }

      // Reset status and start reprocessing
      await storage.updateDocument(req.params.id, { status: "processing", processingProgress: 0 });
      
      // Process asynchronously
      processDocument(doc._id, filePath).catch((error) => {
        console.error("Error reprocessing document:", error);
        storage.updateDocument(doc._id, { status: "error", processingProgress: -1 });
      });

      res.json({ message: "Document reprocessing started", status: "processing" });
    } catch (error) {
      console.error("Error retrying document:", error);
      res.status(500).json({ message: "Failed to retry document" });
    }
  });

  // Chat routes
  app.get("/api/chat/:documentId", isAuthenticated, async (req: any, res: Response) => {
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
  });

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

      // Save user message
      await storage.createChatMessage({
        documentId,
        userId,
        role: "user",
        content,
      });

      // Get chat history
      const chatHistory = await storage.getChatMessages(documentId);
      const historyForAI = chatHistory.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Generate AI response
      let aiResponse: string;
      try {
        aiResponse = await generateChatResponse(
          doc.extractedText || "No text extracted from document.",
          content,
          historyForAI
        );
      } catch (aiError) {
        console.error("AI error:", aiError);
        aiResponse = "I'm sorry, I couldn't process your question. Please try again.";
      }

      // Save AI response
      const assistantMessage = await storage.createChatMessage({
        documentId,
        userId,
        role: "assistant",
        content: aiResponse,
      });

      res.json(assistantMessage);
    } catch (error) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Reports
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

  // On startup, find and re-process any documents that are stuck in the "processing" state.
  // This is a recovery mechanism for documents that were being processed when the server previously crashed.
  (async () => {
    try {
      console.log("Checking for documents stuck in 'processing' state...");
      // In local dev, we use a mock user ID.
      const mockUserId = "mock-user-id-123";
      const documents = await storage.getDocuments(mockUserId);
      const stuckDocuments = documents.filter(doc => doc.status === 'processing');

      if (stuckDocuments.length > 0) {
        console.log(`Found ${stuckDocuments.length} stuck document(s). Restarting processing...`);
        
        const reprocessingPromises = stuckDocuments.map(doc => {
          const filePath = path.join(uploadDir, doc.filename);
          if (fs.existsSync(filePath)) {
            console.log(`- Reprocessing: ${doc.originalName} (ID: ${doc._id})`);
            return processDocument(doc._id, filePath);
          } else {
            console.warn(`- File not found for document ${doc._id}. Marking as error.`);
            return storage.updateDocument(doc._id, { status: "error" });
          }
        });

        await Promise.all(reprocessingPromises);
        console.log("Finished reprocessing stuck documents.");

      } else {
        console.log("No stuck documents found. System is clean.");
      }
    } catch (error) {
      console.error("Error during startup reprocessing of stuck documents:", error);
    }
  })();

  const httpServer = createServer(app);
  return httpServer;
}

// Utility function to add timeout to async operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    )
  ]);
}

async function processDocument(documentId: string, filePath: string): Promise<void> {
  try {
    await storage.updateDocument(documentId, { status: "processing", processingProgress: 10 });

    // Read and parse PDF with timeout (30 seconds max)
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData: any = await withTimeout(
      pdfParse(dataBuffer),
      30000,
      "PDF parsing timed out after 30 seconds"
    );
    
    const text = pdfData.text || "";
    const pageCount = pdfData.numpages || 1;
    
    // Update progress after we have the data
    await storage.updateDocument(documentId, { processingProgress: 25 });

    // Truncate very long texts for faster processing
    const maxTextLength = 50000; // Limit to ~50KB of text
    const processText = text.length > maxTextLength ? text.substring(0, maxTextLength) : text;
    
    // Run page save and NLP in parallel for speed
    const [_, stats] = await Promise.all([
      storage.createPage({
        documentId,
        pageNumber: 1,
        extractedText: text,
        ocrConfidence: 1.0,
      }),
      getTextStatistics(processText)
    ]);
    await storage.updateDocument(documentId, { processingProgress: 40 });

    // Run lighter NLP tasks with timeout (10 seconds max)
    const [entities, nlpKeywords] = await withTimeout(
      Promise.all([
        extractEntities(processText),
        extractKeywordsFromText(processText),
      ]),
      10000,
      "NLP processing timed out"
    ).catch(() => [[], []] as [any[], string[]]);
    
    await storage.updateDocument(documentId, { processingProgress: 60 });

    // Generate quick summary from first few sentences
    const sentences = processText.split(/[.!?]+/).filter((s: string) => s.trim().length > 20).slice(0, 5);
    const summary = sentences.length > 0 
      ? sentences.join(". ") + "." 
      : "No summary available.";

    const analysis: DocumentAnalysis = {
      summary,
      keywords: nlpKeywords.slice(0, 15),
      entities,
      tables: [], // Skip heavy table extraction for speed
      wordCount: stats.wordCount,
      characterCount: stats.characterCount,
    };

    await storage.createExtraction({
      documentId,
      extractionType: "analysis",
      data: analysis,
    });

    // Mark as completed first, then enhance with AI asynchronously (non-blocking)
    await storage.updateDocument(documentId, {
      status: "completed",
      processedAt: new Date(),
      pageCount,
      processingProgress: 100,
    });

    // Enhance with AI if configured (fire and forget - don't block completion)
    if (isGeminiConfigured()) {
      enhanceAnalysisWithAI(documentId, text).catch(error => {
        console.error(`AI enhancement failed for document ${documentId}:`, error);
      });
    }

  } catch (error) {
    console.error("Error processing document:", error);
    await storage.updateDocument(documentId, { status: "error", processingProgress: -1 });
    throw error;
  }
}

async function enhanceAnalysisWithAI(documentId: string, text: string): Promise<void> {
  try {
    // Limit text size for AI to avoid long processing times
    const maxTextLength = 5000;
    const textForAI = text.length > maxTextLength ? text.substring(0, maxTextLength) : text;

    // Add timeout to AI calls (45 seconds max)
    const [summary, aiKeywords] = await withTimeout(
      Promise.all([
        generateDocumentSummary(textForAI),
        extractKeywords(textForAI),
      ]),
      45000,
      "AI enhancement timed out after 45 seconds"
    );

    const existingExtraction = await storage.getExtraction(documentId, "analysis");
    if (existingExtraction) {
      const analysis = existingExtraction.data as DocumentAnalysis;
      analysis.summary = summary;
      // Merge and deduplicate keywords
      const mergedKeywords = Array.from(new Set([...aiKeywords, ...analysis.keywords]));
      analysis.keywords = mergedKeywords.slice(0, 15);
      await storage.updateExtraction(existingExtraction._id, analysis);
    }
  } catch (error) {
    console.error("AI enhancement failed:", error);
    // This is not a critical error, so we don't need to mark the document as failed
  }
}
