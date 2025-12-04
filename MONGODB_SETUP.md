# MongoDB Atlas Integration

## Overview
This project uses **MongoDB Atlas** as the cloud database solution for storing all application data.

## Database Structure

### Collections

1. **users** - User profiles and authentication data
   - `_id`: User ID
   - `email`: User email
   - `firstName`: First name
   - `lastName`: Last name
   - `profileImageUrl`: Profile image URL
   - `role`: User role (default: "user")
   - `createdAt`: Account creation date
   - `updatedAt`: Last update date

2. **documents** - Uploaded PDF documents metadata
   - `_id`: Document ID (ObjectId)
   - `userId`: Owner's user ID
   - `filename`: Stored filename
   - `originalName`: Original upload filename
   - `mimeType`: File MIME type
   - `fileSize`: File size in bytes
   - `status`: Processing status (pending/processing/completed/error)
   - `uploadDate`: Upload timestamp
   - `processedAt`: Processing completion timestamp
   - `pageCount`: Number of pages
   - `processingProgress`: Progress percentage
   - `metadata`: Additional metadata

3. **pages** - Individual pages extracted from documents
   - `_id`: Page ID (ObjectId)
   - `documentId`: Parent document ID
   - `pageNumber`: Page number (1-indexed)
   - `extractedText`: Extracted text content
   - `ocrConfidence`: OCR confidence score
   - `createdAt`: Creation timestamp

4. **extractions** - NLP extractions (entities, keywords, summaries)
   - `_id`: Extraction ID (ObjectId)
   - `documentId`: Parent document ID
   - `extractionType`: Type (entities/keywords/summary)
   - `data`: Extracted data (JSON)
   - `processedAt`: Processing timestamp

5. **chatMessages** - Chat history with documents
   - `_id`: Message ID (ObjectId)
   - `documentId`: Related document ID
   - `userId`: User who sent the message
   - `role`: Message role (user/assistant)
   - `content`: Message content
   - `citations`: Referenced content
   - `createdAt`: Message timestamp

6. **sessions** - Express session storage (managed by connect-mongo)
   - Stores user sessions securely

## Database Indexes

The following indexes are automatically created for optimal performance:

- `documents`: `{ userId: 1, uploadDate: -1 }`, `{ status: 1 }`
- `pages`: `{ documentId: 1, pageNumber: 1 }`
- `extractions`: `{ documentId: 1, extractionType: 1 }`
- `chatMessages`: `{ documentId: 1, createdAt: 1 }`, `{ userId: 1 }`

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority

# Optional: Custom database name (default: intelligent-document-processing)
MONGODB_DB_NAME=intelligent-document-processing

# Session Secret for Express Sessions
SESSION_SECRET=your-secure-random-secret-here
```

### Connection String Format

```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

Replace:
- `<username>`: Your MongoDB Atlas username
- `<password>`: Your MongoDB Atlas password (URL-encoded)
- `<cluster>`: Your cluster address
- `<database>`: Database name (optional, can be set via MONGODB_DB_NAME)

## Features

### ✅ Fully Integrated

- All user data stored in MongoDB Atlas
- All documents metadata stored in database
- Full-text search with MongoDB text indexes
- Chat history persisted in database
- Session management with MongoDB store
- Automatic cascading deletes (delete document → deletes pages, extractions, chats)

### 🚀 Performance Optimizations

- Connection pooling enabled by default
- Indexes on frequently queried fields
- Efficient aggregation queries
- Automatic retry logic for failed operations

### 🔒 Security

- Encrypted connections (TLS/SSL)
- URL-encoded credentials
- Session secrets for security
- User-scoped data access

## Data Flow

1. **Upload**: PDF uploaded → Document record created with status "pending"
2. **Processing**: 
   - Text extracted → Pages created
   - NLP analysis → Extractions created
   - Status updated to "completed"
3. **Chat**: User chats → Messages stored with document reference
4. **Delete**: Document deleted → All related pages, extractions, and chats automatically removed

## Monitoring

Check MongoDB Atlas dashboard for:
- Database size and growth
- Query performance
- Index usage
- Connection metrics
- Real-time operations

## Backup & Recovery

MongoDB Atlas provides:
- Automatic continuous backups
- Point-in-time recovery
- Snapshot downloads
- Cross-region replication

## Troubleshooting

### Connection Issues

```bash
# Test connection
curl "mongodb+srv://<username>:<password>@<cluster>.mongodb.net/test"
```

### Check Database

```javascript
// In MongoDB Shell or Compass
use intelligent-document-processing
db.getCollectionNames()
db.documents.countDocuments()
```

### Common Errors

1. **Authentication Failed**: Check username/password, ensure URL encoding
2. **Network Error**: Check IP whitelist in MongoDB Atlas
3. **Database Not Found**: Will be created automatically on first write

## Migration from Local MongoDB

If migrating from local MongoDB:

```bash
# Export from local
mongodump --db intelligent-document-processing --out ./backup

# Import to Atlas
mongorestore --uri "mongodb+srv://..." --db intelligent-document-processing ./backup/intelligent-document-processing
```

## Best Practices

1. **Never commit** `.env` file with credentials
2. **Use URL encoding** for special characters in passwords
3. **Whitelist IPs** in MongoDB Atlas Network Access
4. **Monitor queries** in Atlas Performance Advisor
5. **Set up alerts** for database size, connections, etc.
6. **Regular backups** via Atlas scheduled snapshots

## Support

- MongoDB Atlas Docs: https://docs.atlas.mongodb.com/
- MongoDB Node.js Driver: https://docs.mongodb.com/drivers/node/
- Community Forums: https://community.mongodb.com/
