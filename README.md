# DocuMind — Intelligent Document Processing Pipeline

A full-stack proof-of-concept for ingesting PDFs, extracting text, performing NLP (entities, keywords, tables), and enabling question-answering over documents using an LLM (Google Gemini) with a React client and a TypeScript + Express server.

**Status:** Ready for local development. Extracted text display and document viewer are implemented. Entities/tables are displayed when extraction data exists for a document.
---

**Table of contents**
- **Overview**
- **Features**
- **Architecture**
- **Tech Stack**
- **Prerequisites**
- **Install & Run (Dev)**
- **Environment Variables**
- **Important Endpoints & Client Routes**
- **How to use**
- **Data model summary**
- **Troubleshooting**
- **Contributing**
- **License**

---

**Overview**

DocuMind (Intelligent Document Processing Pipeline) lets users upload PDF documents, extracts text (and pages), runs NLP to extract entities, keywords and tables, stores structured extractions, and surfaces a chat interface to ask questions about the document (LLM-backed with fallback search). The UI provides document listing, a document viewer (extracted text, entities, tables), reports, and export options.


**Features**
- Upload PDF files and parse text (pdf-parse)
- Store page-level text and a quick `extractedText` preview on the document record
- NLP extractions: entities, keywords, tables, simple stats
- AI enhancements (Google Gemini integration) — optional and configurable via `GEMINI_API_KEY`
- Chat interface bound to a document with citation-style fallbacks
- Reports dashboard with charts and PDF/Word export
- MongoDB Atlas integration with cascaded deletes and indexes


**Architecture**
- Client: React + TypeScript + Vite. Uses React Query for data fetching and Chart.js for charts.
- Server: Node.js + TypeScript + Express (run via `tsx` in dev). Handles uploads, processing pipeline, NLP, and AI calls.
- Database: MongoDB Atlas storing documents, pages, extractions, chat messages.


**Tech Stack**
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, TypeScript (tsx runner)
- Database: MongoDB Atlas
- NLP/AI: compromise for rule-based NLP, Google Generative AI client for Gemini
- PDF parsing: pdf-parse (1.1.1)
- Exports: pdfkit, docx, file-saver, blob-stream
- Charts: Chart.js, react-chartjs-2


**Prerequisites**
- Node.js (v18+ recommended)
- npm
- MongoDB Atlas account (or running MongoDB) and a connection URI


**Install & Run (Dev)**

1. Clone the repo and cd into project:

```bash
cd /path/to/Intelligent-Document-Processing-Pipeline
npm install
```

2. Create an `.env` file (copy from `.env.example`) and fill values (see below):

```bash
cp .env.example .env
# edit .env with your values
```

3. Start the server (in project root):

```bash
# starts the backend (express) and frontend (Vite) depending on your setup
npm run dev
```

The server defaults to port `5005` for the API in development. The client runs via Vite (port shown in the terminal).


**Environment Variables**
Create and configure `.env` with these keys (present in `.env.example`):

- `MONGODB_URI` — MongoDB connection URI (Atlas)
- `MONGODB_DB` — database name (e.g., `intelligent-document-processing`)
- `GEMINI_API_KEY` — (optional) Google Generative AI API key to enable Gemini features
- `PORT` — (optional) API port (defaults to 5005)

Note: If you do not set `GEMINI_API_KEY`, AI enhancement runs will be skipped and the chat will fallback to keyword-based search.


**Important Endpoints (server)**
- `POST /api/documents/upload` — upload a PDF. Returns document record. Upload field name: `file`.
- `GET /api/documents` — list user's documents
- `GET /api/documents/:id` — fetch document with `extractions` and `extractedText`
- `DELETE /api/documents/:id` — delete a document (cascades to pages, extractions, chat)
- `POST /api/chat/:documentId` — ask questions about a document (stores chat messages)
- `GET /api/chat/:documentId` — get chat history for document
- `GET /api/reports` — fetch aggregated reports data


**Client Routes**
- `/documents` — list uploaded documents (click a row to open viewer)
- `/documents/:id` — document viewer (tabs: Extracted Text, Entities, Tables)
- `/upload` — upload a new document
- `/chat/:id` — chat UI tied to a document
- `/reports` — analytics and export


**How to use**
1. Upload a PDF at `/upload`.
2. After processing completes (processing progress shown on list), click the document row.
3. In the Document Viewer:
   - Open **Extracted Text** to read the parsed text (the first ~50KB is stored on the document record for fast access).
   - Open **Entities** to see persons, organizations, locations, dates, money, emails and phones (only visible if extraction data exists).
   - Open **Tables** to view any detected tables.
4. Use **Chat** to ask questions specific to the document. If Gemini is configured, the request is sent to the model; otherwise a keyword fallback is used.
5. If you uploaded older documents before extraction saving was present, reprocessing or reuploading will populate `extractions`.


**Data model summary**
- `documents` collection: document metadata + `extractedText` (preview)
- `pages` collection: page-level text and OCR confidence
- `extractions` collection: structured NLP outputs (analysis, tables, etc.)
- `chatMessages` collection: per-document chat history


**Troubleshooting**
- PostCSS warning: "A PostCSS plugin did not pass the `from` option to `postcss.parse`." — Harmless in dev; consult PostCSS config if CSS transform issues occur.
- Empty `extractions` on older documents: These documents were likely processed before extraction saving was implemented. Reuploading or calling the reprocess endpoint (if available) will regenerate extractions.
- RangeError: `Invalid time value` on `/api/reports` — indicates documents may have missing or invalid `uploadDate`. The backend includes validation, but ensure `uploadDate` is present.
- Gemini / Google errors (404 model not found): The Gemini model name or API version might be incorrect; ensure `GEMINI_API_KEY` is set and the model used by the server is supported by your API key/version.


**Testing**
- Upload a small PDF and confirm the document appears in `/documents` with status `completed`.
- Open `/documents/:id` and check `Extracted Text`. If entities/tables are present, they will display under respective tabs.


**Contributing**
- Fork the repository, make changes on a feature branch, and open a PR against `main`.
- Keep changes scoped and add tests where appropriate.


**License**
This project is provided as-is for demonstration purposes. Add a license file as needed for your use.

---

If you want, I can also:
- Add a minimal `README` badge/header or screenshots from the UI (you provided an attachment screenshot)
- Add a short `docs/` folder with API examples or `curl` snippets
- Add a small script to reprocess existing documents to populate `extractions`

File created: `README.md` at the project root.
