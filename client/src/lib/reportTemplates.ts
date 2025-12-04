import type { ReportsData } from '@shared/mongo-schema';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: ReportSection[];
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'stats' | 'chart' | 'table' | 'text';
  chartType?: 'line' | 'bar' | 'pie';
  dataKey?: keyof ReportsData;
  enabled: boolean;
}

export const reportTemplates: ReportTemplate[] = [
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level overview with key metrics and trends',
    sections: [
      { id: 'overview', title: 'Overview Statistics', type: 'stats', enabled: true },
      { id: 'trends', title: 'Document Trends', type: 'chart', chartType: 'line', dataKey: 'documentsOverTime', enabled: true },
      { id: 'status', title: 'Processing Status', type: 'chart', chartType: 'pie', dataKey: 'statusDistribution', enabled: true },
    ],
  },
  {
    id: 'detailed-analysis',
    name: 'Detailed Analysis',
    description: 'Comprehensive report with all charts and insights',
    sections: [
      { id: 'overview', title: 'Overview Statistics', type: 'stats', enabled: true },
      { id: 'trends', title: 'Documents Over Time', type: 'chart', chartType: 'line', dataKey: 'documentsOverTime', enabled: true },
      { id: 'entities', title: 'Entity Distribution', type: 'chart', chartType: 'pie', dataKey: 'entityDistribution', enabled: true },
      { id: 'keywords', title: 'Top Keywords', type: 'chart', chartType: 'bar', dataKey: 'topKeywords', enabled: true },
      { id: 'status', title: 'Document Status', type: 'chart', chartType: 'bar', dataKey: 'statusDistribution', enabled: true },
    ],
  },
  {
    id: 'keywords-focus',
    name: 'Keywords & Entities',
    description: 'Focus on extracted keywords and entities',
    sections: [
      { id: 'overview', title: 'Overview Statistics', type: 'stats', enabled: true },
      { id: 'keywords', title: 'Top Keywords', type: 'chart', chartType: 'bar', dataKey: 'topKeywords', enabled: true },
      { id: 'entities', title: 'Entity Distribution', type: 'chart', chartType: 'pie', dataKey: 'entityDistribution', enabled: true },
    ],
  },
  {
    id: 'performance-report',
    name: 'Performance Report',
    description: 'Document processing performance and status',
    sections: [
      { id: 'overview', title: 'Overview Statistics', type: 'stats', enabled: true },
      { id: 'status', title: 'Processing Status', type: 'chart', chartType: 'pie', dataKey: 'statusDistribution', enabled: true },
      { id: 'trends', title: 'Upload Trends', type: 'chart', chartType: 'line', dataKey: 'documentsOverTime', enabled: true },
    ],
  },
];

export const getTemplate = (templateId: string): ReportTemplate => {
  return reportTemplates.find(t => t.id === templateId) || reportTemplates[0];
};

export const customizeTemplate = (template: ReportTemplate, customizations: Partial<ReportSection>[]): ReportTemplate => {
  const customized = { ...template };
  customized.sections = template.sections.map(section => {
    const custom = customizations.find(c => c.id === section.id);
    return custom ? { ...section, ...custom } : section;
  });
  return customized;
};
