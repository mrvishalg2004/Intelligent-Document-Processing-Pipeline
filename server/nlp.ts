import nlp from "compromise";
import type { ExtractedEntity, ExtractedTable } from "@shared/mongo-schema";

export function extractEntities(text: string): ExtractedEntity[] {
  const doc = nlp(text);
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  try {
    // Extract people
    doc.people().forEach((person: any) => {
      const text = person.text().trim();
      if (text && text.length > 2 && !seen.has(text.toLowerCase())) {
        seen.add(text.toLowerCase());
        entities.push({
          type: "person",
          text,
          confidence: 0.8,
        });
      }
    });
  } catch (e) {
    console.warn("Failed to extract people:", e);
  }

  try {
    // Extract organizations
    doc.organizations().forEach((org: any) => {
      const text = org.text().trim();
      if (text && text.length > 2 && !seen.has(text.toLowerCase())) {
        seen.add(text.toLowerCase());
        entities.push({
          type: "organization",
          text,
          confidence: 0.75,
        });
      }
    });
  } catch (e) {
    console.warn("Failed to extract organizations:", e);
  }

  try {
    // Extract places/locations
    doc.places().forEach((place: any) => {
      const text = place.text().trim();
      if (text && text.length > 2 && !seen.has(text.toLowerCase())) {
        seen.add(text.toLowerCase());
        entities.push({
          type: "location",
          text,
          confidence: 0.7,
        });
      }
    });
  } catch (e) {
    console.warn("Failed to extract places:", e);
  }

  try {
    // Extract dates - check if dates() method exists
    if (typeof doc.dates === 'function') {
      doc.dates().forEach((date: any) => {
        const text = date.text().trim();
        if (text && !seen.has(text.toLowerCase())) {
          seen.add(text.toLowerCase());
          entities.push({
            type: "date",
            text,
            confidence: 0.85,
          });
        }
      });
    }
  } catch (e) {
    console.warn("Failed to extract dates:", e);
  }

  try {
    // Extract money/values - check if money() method exists
    if (typeof doc.money === 'function') {
      doc.money().forEach((money: any) => {
        const text = money.text().trim();
        if (text && !seen.has(text.toLowerCase())) {
          seen.add(text.toLowerCase());
          entities.push({
            type: "money",
            text,
            confidence: 0.9,
          });
        }
      });
    }
  } catch (e) {
    console.warn("Failed to extract money:", e);
  }

  return entities;
}

export function extractKeywordsFromText(text: string): string[] {
  const doc = nlp(text);
  const keywords: string[] = [];
  const seen = new Set<string>();

  // Get nouns and noun phrases
  doc.nouns().forEach((noun: any) => {
    const word = noun.text().toLowerCase().trim();
    if (word && word.length > 3 && !seen.has(word)) {
      seen.add(word);
      keywords.push(word);
    }
  });

  // Get topics/subjects
  doc.topics().forEach((topic: any) => {
    const word = topic.text().toLowerCase().trim();
    if (word && word.length > 3 && !seen.has(word)) {
      seen.add(word);
      keywords.push(word);
    }
  });

  // Sort by frequency in text and return top keywords
  const wordCounts = new Map<string, number>();
  keywords.forEach((word) => {
    // Escape special regex characters to avoid regex syntax errors
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const count = (text.match(new RegExp(escapedWord, "gi")) || []).length;
      wordCounts.set(word, count);
    } catch (e) {
      // If regex fails, just set count to 1
      wordCounts.set(word, 1);
    }
  });

  return keywords
    .sort((a, b) => (wordCounts.get(b) || 0) - (wordCounts.get(a) || 0))
    .slice(0, 15);
}

export function extractTablesFromText(text: string): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  
  // Look for simple table-like patterns in text
  // This is a basic heuristic - for advanced table extraction, specialized libraries would be needed
  const lines = text.split("\n");
  let currentTable: ExtractedTable | null = null;
  let consecutiveTableRows = 0;

  for (const line of lines) {
    // Check if line looks like a table row (has multiple tabs or pipe separators)
    const hasTabs = (line.match(/\t/g) || []).length >= 2;
    const hasPipes = (line.match(/\|/g) || []).length >= 2;
    const hasMultipleSpaces = /\s{3,}/.test(line) && line.trim().length > 0;

    if (hasTabs || hasPipes || hasMultipleSpaces) {
      const cells = hasPipes
        ? line.split("|").map((c) => c.trim()).filter(Boolean)
        : hasTabs
        ? line.split("\t").map((c) => c.trim()).filter(Boolean)
        : line.split(/\s{3,}/).map((c) => c.trim()).filter(Boolean);

      if (cells.length >= 2) {
        consecutiveTableRows++;

        if (!currentTable) {
          currentTable = {
            headers: cells,
            rows: [],
          };
        } else if (consecutiveTableRows === 2) {
          // First row after header
          currentTable.rows.push(cells);
        } else {
          currentTable.rows.push(cells);
        }
      }
    } else {
      // End of potential table
      if (currentTable && currentTable.rows.length > 0) {
        tables.push(currentTable);
      }
      currentTable = null;
      consecutiveTableRows = 0;
    }
  }

  // Don't forget the last table if text ends with one
  if (currentTable && currentTable.rows.length > 0) {
    tables.push(currentTable);
  }

  return tables;
}

export function getTextStatistics(text: string): { wordCount: number; characterCount: number } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return {
    wordCount: words.length,
    characterCount: text.length,
  };
}
