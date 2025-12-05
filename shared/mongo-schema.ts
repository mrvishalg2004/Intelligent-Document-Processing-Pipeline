import { z } from "zod";

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
  role: z.string().default("user"),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export const DocumentSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  status: z.string().default("pending"),
  uploadDate: z.date().default(() => new Date()),
  processedAt: z.date().optional(),
  pageCount: z.number().optional(),
  metadata: z.any().optional(),
  processingProgress: z.number().optional(),
  extractedText: z.string().optional(),
});

export const PageSchema = z.object({
  _id: z.string(),
  documentId: z.string(),
  pageNumber: z.number(),
  extractedText: z.string().optional(),
  ocrConfidence: z.number().optional(),
  createdAt: z.date().default(() => new Date()),
});

export const ExtractionSchema = z.object({
  _id: z.string(),
  documentId: z.string(),
  extractionType: z.string(),
  data: z.any(),
  processedAt: z.date().default(() => new Date()),
});

export const ChatMessageSchema = z.object({
  _id: z.string(),
  documentId: z.string(),
  userId: z.string(),
  role: z.string(),
  content: z.string(),
  citations: z.any().optional(),
  createdAt: z.date().default(() => new Date()),
});

export type User = z.infer<typeof UserSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Document Analysis Type for NLP Extractions
export interface DocumentAnalysis {
  entities: {
    persons: string[];
    organizations: string[];
    locations: string[];
    dates: string[];
    money: string[];
    emails: string[];
    phones: string[];
  };
  keywords: string[];
  summary: string;
  tables: any[];
  statistics: {
    wordCount: number;
    charCount: number;
    sentenceCount: number;
    paragraphCount: number;
    avgWordsPerSentence: number;
    readingTime: number;
  };
}

// Entity extraction types
export interface ExtractedEntity {
  type: string;
  text: string;
  confidence: number;
}

export interface ExtractedTable {
  headers: string[];
  rows: string[][];
  confidence: number;
}

// Reports Data Type
export interface ReportsData {
  totalDocuments: number;
  totalPages: number;
  totalWords: number;
  documentsOverTime: Array<{ date: string; count: number }>;
  entityDistribution: Array<{ name: string; value: number }>;
  topKeywords: Array<{ keyword: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
}
