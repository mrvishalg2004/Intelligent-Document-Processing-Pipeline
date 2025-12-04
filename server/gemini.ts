import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { Content } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
} else {
  console.warn("GEMINI_API_KEY is not set. AI features will be limited.");
}

export function isGeminiConfigured(): boolean {
  return !!API_KEY && !!genAI;
}

export async function generateChatResponse(
  documentContent: string,
  userQuestion: string,
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  if (!genAI) {
    throw new Error("Gemini AI is not configured");
  }
  
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const formattedHistory: Content[] = chatHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const chat = model.startChat({
    history: formattedHistory,
    generationConfig: {
      maxOutputTokens: 1000,
    },
    safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
  });

  const prompt = `Based on the following document content, answer the user's question.
  
  Document Content:
  ---
  ${documentContent.slice(0, 8000)}
  ---

  User Question: "${userQuestion}"
  `;

  const result = await chat.sendMessage(prompt);
  const response = await result.response;
  return response.text();
}

export async function generateDocumentSummary(text: string): Promise<string> {
  if (!genAI) {
    throw new Error("Gemini AI is not configured");
  }
  
  const model = genAI.getGenerativeModel({ model: "gemini-pro"});
  const prompt = `Summarize the following text, focusing on the main points and key takeaways.:\n\n${text.slice(0, 12000)}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

export async function extractKeywords(text: string): Promise<string[]> {
  if (!genAI) {
    throw new Error("Gemini AI is not configured");
  }
  
  const model = genAI.getGenerativeModel({ model: "gemini-pro"});
  const prompt = `Extract the 8-12 most important keywords or key phrases from the following text. Return them as a comma-separated list:\n\n${text.slice(0, 12000)}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const keywords = response.text().split(",").map(kw => kw.trim());
  return keywords;
}
