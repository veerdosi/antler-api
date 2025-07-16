import fs from 'fs';
import path from 'path';
import { AntlerCompany, CompanyStats } from './types';

export function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function extractYear(text: string): number {
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
}

export function normalizeLocation(location: string): string {
  return location.replace(/,?\s*(UK|USA|US)$/i, '').trim();
}

export function extractCountry(location: string): string {
  const countryMatch = location.match(/(UK|USA|US|United States|United Kingdom)$/i);
  if (countryMatch) {
    const match = countryMatch[0].toLowerCase();
    if (match === 'uk' || match === 'united kingdom') return 'United Kingdom';
    if (match === 'usa' || match === 'us' || match === 'united states') return 'United States';
  }
  
  const parts = location.split(',');
  return parts.length > 1 ? parts[parts.length - 1].trim() : location;
}

export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function writeJsonFile(filePath: string, data: any): void {
  ensureDirectoryExists(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function readJsonFile(filePath: string): any {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

export function generateCompanyStats(companies: AntlerCompany[]): CompanyStats {
  const stats: CompanyStats = {
    totalCompanies: companies.length,
    sectorDistribution: {},
    locationDistribution: {},
    yearDistribution: {},
    lastUpdated: new Date().toISOString()
  };

  companies.forEach(company => {
    stats.sectorDistribution[company.sector] = (stats.sectorDistribution[company.sector] || 0) + 1;
    stats.locationDistribution[company.location] = (stats.locationDistribution[company.location] || 0) + 1;
    stats.yearDistribution[company.founded_year] = (stats.yearDistribution[company.founded_year] || 0) + 1;
  });

  return stats;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9.-]/gi, '_');
}

export function logProgress(message: string, progress?: { current: number; total: number }): void {
  const timestamp = new Date().toISOString();
  const progressStr = progress ? `[${progress.current}/${progress.total}]` : '';
  console.log(`[${timestamp}] ${progressStr} ${message}`);
}