export interface AntlerCompany {
  id: string;
  name: string;
  slug: string;
  website: string;
  description: string;
  founded_year: number;
  location: string;
  sector: string;
  logo_url: string;
  url: string;
  api: string;
}

export interface ScrapingConfig {
  baseUrl: string;
  maxPages: number;
  delay: number;
  retryAttempts: number;
  outputDir: string;
}

export interface ScrapingProgress {
  totalCompanies: number;
  processedCompanies: number;
  currentPage: number;
  errors: string[];
}

export interface CompanyStats {
  totalCompanies: number;
  sectorDistribution: Record<string, number>;
  locationDistribution: Record<string, number>;
  yearDistribution: Record<string, number>;
  lastUpdated: string;
}

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}