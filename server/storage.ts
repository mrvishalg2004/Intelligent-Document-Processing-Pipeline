import { Collection, Db, ObjectId } from 'mongodb';
import { db } from './db';
import type { User, Document, Page, Extraction, ChatMessage } from '@shared/mongo-schema';

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | null>;
  upsertUser(user: Partial<User>): Promise<User>;

  // Document operations
  getDocuments(userId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | null>;
  getDocumentWithExtractions(id: string): Promise<(Document & { extractions: Extraction[]; extractedText?: string }) | null>;
  createDocument(doc: Partial<Document>): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | null>;
  deleteDocument(id: string): Promise<void>;
  searchDocuments(userId: string, query: string): Promise<Document[]>;

  // Page operations
  createPage(page: Partial<Page>): Promise<Page>;
  getPages(documentId: string): Promise<Page[]>;

  // Extraction operations
  createExtraction(extraction: Partial<Extraction>): Promise<Extraction>;
  getExtractions(documentId: string): Promise<Extraction[]>;

  // Chat operations
  getChatMessages(documentId: string): Promise<ChatMessage[]>;
  createChatMessage(message: Partial<ChatMessage>): Promise<ChatMessage>;

  // Dashboard stats
  getDashboardStats(userId: string): Promise<any>;

  // Reports data
  getReportsData(userId: string): Promise<any>;
}

export class MongoStorage implements IStorage {
  private users: Collection<User>;
  private documents: Collection<Document>;
  private pages: Collection<Page>;
  private extractions: Collection<Extraction>;
  private chatMessages: Collection<ChatMessage>;

  constructor(db: Db) {
    this.users = db.collection<User>('users');
    this.documents = db.collection<Document>('documents');
    this.pages = db.collection<Page>('pages');
    this.extractions = db.collection<Extraction>('extractions');
    this.chatMessages = db.collection<ChatMessage>('chatMessages');
  }

  // User operations
  async getUser(id: string): Promise<User | null> {
    return this.users.findOne({ _id: id });
  }

  async upsertUser(user: Partial<User>): Promise<User> {
    const result = await this.users.findOneAndUpdate(
      { _id: user._id },
      { $set: user, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    return result!;
  }

  // Document operations
  async getDocuments(userId: string): Promise<Document[]> {
    return this.documents.find({ userId }).sort({ uploadDate: -1 }).toArray();
  }

  async getDocument(id: string): Promise<Document | null> {
    return this.documents.findOne({ _id: new ObjectId(id) as any });
  }

  async getDocumentWithExtractions(id: string): Promise<(Document & { extractions: Extraction[]; extractedText?: string }) | null> {
    const doc = await this.getDocument(id);
    if (!doc) return null;

    const extractions = await this.getExtractions(id);
    const pages = await this.getPages(id);
    const extractedText = pages.map(p => p.extractedText).join('\n\n');

    return { ...doc, extractions, extractedText };
  }

  async createDocument(doc: Partial<Document>): Promise<Document> {
    const result = await this.documents.insertOne({ ...doc, _id: new ObjectId() as any });
    return { ...doc, _id: result.insertedId } as Document;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | null> {
    const result = await this.documents.findOneAndUpdate(
      { _id: new ObjectId(id) as any },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.documents.deleteOne({ _id: new ObjectId(id) as any });
  }

  async searchDocuments(userId: string, query: string): Promise<Document[]> {
    return this.documents.find({
      userId,
      originalName: { $regex: query, $options: 'i' }
    }).sort({ uploadDate: -1 }).toArray();
  }

  // Page operations
  async createPage(page: Partial<Page>): Promise<Page> {
    const result = await this.pages.insertOne({ ...page, _id: new ObjectId() as any });
    return { ...page, _id: result.insertedId } as Page;
  }

  async getPages(documentId: string): Promise<Page[]> {
    return this.pages.find({ documentId }).sort({ pageNumber: 1 }).toArray();
  }

  // Extraction operations
  async createExtraction(extraction: Partial<Extraction>): Promise<Extraction> {
    const result = await this.extractions.insertOne({ ...extraction, _id: new ObjectId() as any });
    return { ...extraction, _id: result.insertedId } as Extraction;
  }

  async getExtractions(documentId: string): Promise<Extraction[]> {
    return this.extractions.find({ documentId }).toArray();
  }

  // Chat operations
  async getChatMessages(documentId: string): Promise<ChatMessage[]> {
    return this.chatMessages.find({ documentId }).sort({ createdAt: 1 }).toArray();
  }

  async createChatMessage(message: Partial<ChatMessage>): Promise<ChatMessage> {
    const result = await this.chatMessages.insertOne({ ...message, _id: new ObjectId() as any });
    return { ...message, _id: result.insertedId } as ChatMessage;
  }

  // Dashboard stats
  async getDashboardStats(userId: string): Promise<any> {
    const allDocs = await this.getDocuments(userId);
    const recentDocuments = allDocs.slice(0, 5);

    return {
      totalDocuments: allDocs.length,
      processingCount: allDocs.filter(d => d.status === 'processing').length,
      completedCount: allDocs.filter(d => d.status === 'completed').length,
      errorCount: allDocs.filter(d => d.status === 'error').length,
      recentDocuments,
    };
  }

  // Reports data
  async getReportsData(userId: string): Promise<any> {
    // Implementation for reports data can be added here
    return {};
  }
}

export const storage = new MongoStorage(db);
