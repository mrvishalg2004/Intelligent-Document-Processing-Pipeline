import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export function isGeminiConfigured(): boolean {
  return !!API_KEY;
}

export async function generateDocumentSummary(text: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-pro"});
  const prompt = `Summarize the following text:

${text}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

export async function extractKeywords(text: string): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-pro"});
  const prompt = `Extract the most important keywords from the following text. Return them as a comma-separated list:

${text}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const keywords = response.text().split(",").map(kw => kw.trim());
  return keywords;
}
