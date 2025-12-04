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
  getExtraction(documentId: string, extractionType: string): Promise<Extraction | null>;
  updateExtraction(id: string, data: any): Promise<Extraction | null>;

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
    
    // Create indexes for better performance
    this.initializeIndexes();
  }

  private async initializeIndexes() {
    try {
      // Document indexes
      await this.documents.createIndex({ userId: 1, uploadDate: -1 });
      await this.documents.createIndex({ status: 1 });
      
      // Page indexes
      await this.pages.createIndex({ documentId: 1, pageNumber: 1 });
      
      // Extraction indexes
      await this.extractions.createIndex({ documentId: 1, extractionType: 1 });
      
      // Chat message indexes
      await this.chatMessages.createIndex({ documentId: 1, createdAt: 1 });
      await this.chatMessages.createIndex({ userId: 1 });
    } catch (error) {
      console.error('Error creating indexes:', error);
    }
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
    
    // Use extractedText from document if available, otherwise get from pages
    let extractedText = doc.extractedText || '';
    
    if (!extractedText) {
      const pages = await this.getPages(id);
      extractedText = pages
        .map(p => p.extractedText || '')
        .filter(text => text.trim().length > 0)
        .join('\n\n');
    }

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
    const objectId = new ObjectId(id);
    
    // Delete document and all associated data
    await Promise.all([
      this.documents.deleteOne({ _id: objectId as any }),
      this.pages.deleteMany({ documentId: id }),
      this.extractions.deleteMany({ documentId: id }),
      this.chatMessages.deleteMany({ documentId: id })
    ]);
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

  async getExtraction(documentId: string, extractionType: string): Promise<Extraction | null> {
    return this.extractions.findOne({ documentId, extractionType });
  }

  async updateExtraction(id: string, data: any): Promise<Extraction | null> {
    const result = await this.extractions.findOneAndUpdate(
      { _id: new ObjectId(id) as any },
      { $set: { data, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
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
    const allDocs = await this.getDocuments(userId);
    const completedDocs = allDocs.filter(d => d.status === 'completed');
    
    // Calculate total pages and words
    let totalPages = 0;
    let totalWords = 0;
    const entityCounts: Record<string, number> = {};
    const keywordCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    
    for (const doc of allDocs) {
      totalPages += doc.pageCount || 0;
      
      // Status distribution
      statusCounts[doc.status] = (statusCounts[doc.status] || 0) + 1;
      
      // Get extractions for word count, entities, and keywords
      const extractions = await this.getExtractions((doc as any)._id.toString());
      const analysisExtraction = extractions.find(e => e.extractionType === 'analysis');
      
      if (analysisExtraction && analysisExtraction.data) {
        const data = analysisExtraction.data;
        
        // Word count
        if (data.statistics?.wordCount) {
          totalWords += data.statistics.wordCount;
        }
        
        // Count entities
        if (data.entities) {
          const allEntities = [
            ...(data.entities.persons || []),
            ...(data.entities.organizations || []),
            ...(data.entities.locations || []),
            ...(data.entities.dates || []),
            ...(data.entities.money || [])
          ];
          
          allEntities.forEach(entity => {
            entityCounts[entity] = (entityCounts[entity] || 0) + 1;
          });
        }
        
        // Count keywords
        if (data.keywords && Array.isArray(data.keywords)) {
          data.keywords.forEach((keyword: string) => {
            keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
          });
        }
      }
    }
    
    // Documents over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const docsByDate: Record<string, number> = {};
    allDocs.forEach(doc => {
      try {
        const uploadDate = doc.uploadDate ? new Date(doc.uploadDate) : new Date();
        if (!isNaN(uploadDate.getTime())) {
          const date = uploadDate.toISOString().split('T')[0];
          docsByDate[date] = (docsByDate[date] || 0) + 1;
        }
      } catch (error) {
        console.error('Invalid date for document:', doc);
      }
    });
    
    const documentsOverTime = Object.entries(docsByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
    
    // Top entities (top 5)
    const entityDistribution = Object.entries(entityCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    
    // Top keywords (top 10)
    const topKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Status distribution
    const statusDistribution = Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count }));
    
    return {
      totalDocuments: allDocs.length,
      totalPages,
      totalWords,
      documentsOverTime,
      entityDistribution,
      topKeywords,
      statusDistribution,
    };
  }
}

export const storage = new MongoStorage(db);
