
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, ImageRun } from 'docx';
import { Chart } from 'chart.js';
import type { ReportsData } from '@shared/mongo-schema';

// Browser-compatible Buffer replacement
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const getChartAsBase64Image = (chart: Chart | null): string => {
  if (!chart) return '';
  return chart.toBase64Image();
};

export const exportToPdf = async (reportsData: ReportsData, charts: { [key: string]: Chart | null }) => {
  try {
    // Use a simpler approach that doesn't rely on PDFKit
    const content = generateHtmlReport(reportsData, charts);
    const blob = new Blob([content], { type: 'text/html' });
    saveAs(blob, 'reports.html');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('PDF export is temporarily unavailable. Please use Word export instead.');
  }
};

const generateHtmlReport = (reportsData: ReportsData, charts: { [key: string]: Chart | null }): string => {
  const chartImages = Object.entries(charts)
    .filter(([_, chart]) => chart)
    .map(([key, chart]) => {
      const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
      const image = getChartAsBase64Image(chart);
      return `
        <div style="page-break-inside: avoid; margin: 20px 0;">
          <h2>${title}</h2>
          <img src="${image}" style="max-width: 100%; height: auto;" alt="${title}">
        </div>
      `;
    }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reports & Analytics</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; text-align: center; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat { text-align: center; padding: 10px; }
        @media print { 
          body { margin: 0; } 
          .page-break { page-break-before: always; }
        }
      </style>
    </head>
    <body>
      <h1>Reports & Analytics</h1>
      <div class="stats">
        <div class="stat"><strong>Total Documents:</strong> ${reportsData.totalDocuments}</div>
        <div class="stat"><strong>Total Pages:</strong> ${reportsData.totalPages}</div>
        <div class="stat"><strong>Total Words:</strong> ${reportsData.totalWords}</div>
      </div>
      ${chartImages}
    </body>
    </html>
  `;
};

export const exportToWord = async (reportsData: ReportsData, charts: { [key: string]: Chart | null }) => {
  try {
    const children = [
      new Paragraph({ text: "Reports & Analytics", style: "Heading1"}),
      new Paragraph({ text: `Total Documents: ${reportsData.totalDocuments}` }),
      new Paragraph({ text: `Total Pages: ${reportsData.totalPages}` }),
      new Paragraph({ text: `Total Words: ${reportsData.totalWords}` }),
    ];

    for (const [key, chart] of Object.entries(charts)) {
      const image = getChartAsBase64Image(chart);
      if (image && chart) {
          const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
          children.push(new Paragraph({ text: title, style: "Heading2" }));
          
          try {
            const imageData = base64ToUint8Array(image.split(',')[1]);
            children.push(new Paragraph({
              children: [
                new ImageRun({
                  data: imageData,
                  transformation: {
                    width: 500,
                    height: 300
                  },
                  type: 'png'
                })
              ]
            }));
          } catch (imgError) {
            console.error('Error adding image to document:', imgError);
            children.push(new Paragraph({ text: `[Chart: ${title} - Image could not be embedded]` }));
          }
      }
    }

    const doc = new Document({
      styles: {
          paragraphStyles: [
              {
                  id: "Heading1",
                  name: "Heading 1",
                  basedOn: "Normal",
                  next: "Normal",
                  quickFormat: true,
                  run: {
                      size: 32,
                      bold: true,
                      color: "000000",
                  },
                  paragraph: {
                      spacing: { after: 240 },
                  },
              },
              {
                  id: "Heading2",
                  name: "Heading 2",
                  basedOn: "Normal",
                  next: "Normal",
                  quickFormat: true,
                  run: {
                      size: 24,
                      bold: true,
                      color: "000000",
                  },
                  paragraph: {
                      spacing: { before: 240, after: 120 },
                  },
              },
          ],
      },
      sections: [{
          properties: {},
          children: children,
        },],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "reports.docx");
  } catch (error) {
    console.error('Error exporting to Word:', error);
    alert('Error exporting to Word document. Please try again.');
  }
};
