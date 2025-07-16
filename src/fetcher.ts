import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { AntlerCompany, ScrapingConfig, ScrapingProgress } from './types';
import { 
  createSlug, 
  extractYear, 
  normalizeLocation, 
  extractCountry, 
  writeJsonFile, 
  readJsonFile, 
  generateCompanyStats, 
  sleep, 
  logProgress 
} from './utils';

export class AntlerPortfolioScraper {
  private config: ScrapingConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private companies: AntlerCompany[] = [];
  private progress: ScrapingProgress = {
    totalCompanies: 0,
    processedCompanies: 0,
    currentPage: 0,
    errors: []
  };

  constructor(config: Partial<ScrapingConfig> = {}) {
    this.config = {
      baseUrl: 'https://www.antler.co/portfolio',
      maxPages: 20,
      delay: 2000,
      retryAttempts: 3,
      outputDir: './companies',
      ...config
    };
  }

  async init(): Promise<void> {
    logProgress('Initializing browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  async scrapePortfolio(): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    logProgress('Starting portfolio scraping...');
    
    try {
      await this.page.goto(this.config.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      await this.extractCompanyData();
      await this.generateOutputFiles();

    } catch (error) {
      logProgress(`Error during scraping: ${error}`);
      this.progress.errors.push(`Scraping error: ${error}`);
      throw error;
    }
  }


  private async extractCompanyData(): Promise<void> {
    logProgress('Extracting company data from all pages...');
    
    let currentPage = 1;
    let hasMorePages = true;
    
    while (hasMorePages && currentPage <= this.config.maxPages) {
      try {
        if (currentPage > 1) {
          const nextPageUrl = `${this.config.baseUrl}?8cea4155_page=${currentPage}`;
          logProgress(`Extracting from page ${currentPage}: ${nextPageUrl}`);
          
          await this.page!.goto(nextPageUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });
          
          await sleep(this.config.delay);
        }
        
        // Wait for page content to load
        try {
          await this.page!.waitForSelector('[class*="portfolio"], main, body', { timeout: 15000 });
          logProgress('Page content loaded successfully');
        } catch (error) {
          logProgress('Page content taking longer to load, proceeding anyway...');
        }
        
        // Give the page time to load content
        await sleep(2000);
        
        // Extract companies from current page
        const pageCompanies = await this.extractCompaniesFromCurrentPage();
        
        if (pageCompanies.length === 0) {
          logProgress(`No companies found on page ${currentPage}, stopping`);
          hasMorePages = false;
        } else {
          logProgress(`Extracted ${pageCompanies.length} companies from page ${currentPage}`);
          
          // Filter out duplicates based on slug
          const existingSlugs = new Set(this.companies.map(c => c.slug));
          const newCompanies = pageCompanies.filter(c => !existingSlugs.has(c.slug));
          
          // Stop if no new companies found
          if (newCompanies.length === 0) {
            logProgress(`No new companies found on page ${currentPage}, stopping scraping`);
            hasMorePages = false;
          } else {
            this.companies.push(...newCompanies);
            this.progress.processedCompanies += newCompanies.length;
            
            if (newCompanies.length < pageCompanies.length) {
              logProgress(`Filtered out ${pageCompanies.length - newCompanies.length} duplicate companies`);
            }
            
            // Save companies immediately after each page
            await this.savePageCompanies(pageCompanies);
            
            currentPage++;
          }
        }
        
      } catch (error) {
        logProgress(`Error extracting from page ${currentPage}: ${error}`);
        hasMorePages = false;
      }
    }

    this.progress.totalCompanies = this.companies.length;
    logProgress(`Successfully extracted ${this.companies.length} companies from ${currentPage - 1} pages`);
  }

  private async extractCompaniesFromCurrentPage(): Promise<AntlerCompany[]> {
    const companies: AntlerCompany[] = [];
    
    const html = await this.page!.content();
    const $ = cheerio.load(html);
    
    // Look for company cards - start with the broadest working selector
    let companyLinks = $('a[href^="https://"]');
    logProgress(`Found ${companyLinks.length} total links with https`);
    
    // Try to find more specific portfolio container first
    const portfolioContainer = $('[class*="portfolio"]');
    if (portfolioContainer.length > 0) {
      const portfolioLinks = portfolioContainer.find('a[href^="https://"]');
      if (portfolioLinks.length > 0) {
        companyLinks = portfolioLinks;
        logProgress(`Using portfolio container, found ${companyLinks.length} links`);
      }
    }
    
    // Filter out non-company links
    companyLinks = companyLinks.filter((i, el) => {
      const href = $(el).attr('href');
      return !!(href && 
        !href.includes('antler.co') && 
        !href.includes('linkedin.com') && 
        !href.includes('twitter.com') && 
        !href.includes('facebook.com') && 
        !href.includes('instagram.com') &&
        !href.includes('youtube.com') &&
        !href.includes('tiktok.com') &&
        !href.includes('github.com') &&
        !href.includes('medium.com') &&
        !href.includes('apple.com') &&
        !href.includes('google.com') &&
        !href.includes('mailto:') &&
        !href.includes('tel:') &&
        href.length > 10
      );
    });

    logProgress(`Found ${companyLinks.length} company links on current page`);

    // Track processed websites to avoid duplicates within the same page
    const processedWebsites = new Set<string>();

    for (let i = 0; i < companyLinks.length; i++) {
      const element = companyLinks[i];
      const website = $(element).attr('href') || '';
      
      // Skip if we already processed this website on this page
      if (processedWebsites.has(website)) {
        logProgress(`Skipping duplicate website: ${website}`);
        continue;
      }
      processedWebsites.add(website);
      
      const company = await this.extractCompanyFromElement($, element, i);
      
      if (company) {
        companies.push(company);
      }
    }

    logProgress(`Processed ${companies.length} unique companies from ${companyLinks.length} links`);
    return companies;
  }

  private extractCompanyFromElement($: cheerio.CheerioAPI, element: any, index: number): AntlerCompany | null {
    try {
      const $el = $(element);
      
      // Extract website URL from the link
      const website = $el.attr('href') || '';
      if (!website || website.length < 5) return null;
      
      // Look for company card container - check parent elements more thoroughly
      let $card = $el;
      const parentSelectors = ['[class*="card"]', '[class*="item"]', '[class*="company"]', 'div', 'li'];
      for (const selector of parentSelectors) {
        const $parent = $el.closest(selector);
        if ($parent.length > 0 && $parent.text().trim().length > $card.text().trim().length) {
          $card = $parent;
          break;
        }
      }
      
      // Extract company name with improved selectors
      let name = this.extractText($card, 'h1, h2, h3, h4, h5, h6') || 
                 this.extractText($card, '[class*="name"], [class*="title"], [class*="company"]') ||
                 this.extractText($card, 'strong, b') ||
                 $card.find('img').first().attr('alt') || '';
      
      if (!name) {
        // Extract from URL as fallback
        const urlParts = website.replace(/^https?:\/\//, '').split('/')[0].split('.');
        name = urlParts.length > 1 ? urlParts[0] : urlParts[urlParts.length - 1];
        name = name.charAt(0).toUpperCase() + name.slice(1);
      }
      
      if (!name || name.length < 2) return null;

      // Extract description with better selectors
      let description = this.extractText($card, 'p:not([class*="tag"]):not([class*="badge"]):not([class*="year"]):not([class*="location"]):not([class*="sector"])') || 
                       this.extractText($card, '[class*="description"], [class*="summary"], [class*="intro"]') ||
                       this.extractText($card, 'div:not([class*="tag"]):not([class*="badge"]):not([class*="year"]):not([class*="location"]):not([class*="sector"]) p') ||
                       '';
      
      // If no description found, try to extract from longer text blocks
      if (!description || description.length < 10) {
        const textElements = $card.find('*').filter((i, el) => {
          const text = $(el).text().trim();
          return text.length > 20 && text.length < 300 && 
                 !text.includes('http') && 
                 !text.match(/^\d{4}$/) &&
                 !$(el).is('a, img, script, style');
        });
        if (textElements.length > 0) {
          description = $(textElements[0]).text().trim();
        }
      }
      
      if (!description || description.length < 5) {
        description = `${name} is a portfolio company of Antler.`;
      }
      
      // Extract metadata based on the actual Antler portfolio structure
      // Pattern: Logo -> Year -> Location -> Sector -> Name+Description
      let location = '';
      let sector = '';
      
      // Find all links with href="#" which contain location and sector
      const hashLinks = $card.find('a[href="#"]');
      
      if (hashLinks.length >= 2) {
        // First hash link should be location, second should be sector
        const firstLink = $(hashLinks[0]).text().trim();
        const secondLink = $(hashLinks[1]).text().trim();
        
        if (this.isLocationText(firstLink)) {
          location = firstLink;
          if (this.isSectorText(secondLink)) {
            sector = secondLink;
          }
        } else if (this.isSectorText(firstLink)) {
          sector = firstLink;
          if (this.isLocationText(secondLink)) {
            location = secondLink;
          }
        }
      } else if (hashLinks.length === 1) {
        // Only one hash link - determine if it's location or sector
        const linkText = $(hashLinks[0]).text().trim();
        if (this.isLocationText(linkText)) {
          location = linkText;
        } else if (this.isSectorText(linkText)) {
          sector = linkText;
        }
      }
      
      // If no hash links found, try the old bracket method as fallback
      if (!location && !sector) {
        const cardText = $card.text();
        const bracketLocationMatch = cardText.match(/\[([^\]]+)\]/g);
        if (bracketLocationMatch) {
          for (const match of bracketLocationMatch) {
            const text = match.replace(/[\[\]]/g, '').trim();
            if (!location && this.isLocationText(text)) {
              location = text;
            } else if (!sector && this.isSectorText(text) && !this.isLocationText(text)) {
              sector = text;
            }
          }
        }
      }
      
      // Extract logo with better handling
      let logoUrl = this.extractAttribute($card, 'img', 'src') || '';
      if (logoUrl && !logoUrl.startsWith('http')) {
        logoUrl = logoUrl.startsWith('//') ? `https:${logoUrl}` : 
                 logoUrl.startsWith('/') ? `https://www.antler.co${logoUrl}` : 
                 `https://${logoUrl}`;
      }
      
      // Extract founded year - structural pattern method only
      let foundedYear: number = 0;
      
      const cardHtml = $card.html() || '';
      const structuralYearMatch = cardHtml.match(/<img[^>]*>.*?(\b(?:19[4-9]\d|20[0-2]\d)\b)/);
      if (structuralYearMatch) {
        const year = parseInt(structuralYearMatch[1]);
        if (year >= 1940 && year <= new Date().getFullYear()) {
          foundedYear = year;
        }
      }
      
      const slug = createSlug(name);
      const normalizedLocation = normalizeLocation(location);

      const company: AntlerCompany = {
        id: `antler-${slug}`,
        name: name.trim(),
        slug,
        website: website.startsWith('http') ? website : `https://${website}`,
        description: description.trim(),
        founded_year: foundedYear,
        location: normalizedLocation || 'Unknown',
        sector: sector || 'Unknown',
        logo_url: logoUrl || '',
        url: `https://www.antler.co/portfolio/${slug}`,
        api: `https://antler-api.github.io/companies/${slug}.json`
      };

      return company;

    } catch (error) {
      logProgress(`Error extracting company at index ${index}: ${error}`);
      return null;
    }
  }

  private extractText($el: cheerio.Cheerio<any>, selector: string): string {
    const element = $el.find(selector).first();
    return element.length > 0 ? element.text().trim() : '';
  }

  private extractAttribute($el: cheerio.Cheerio<any>, selector: string, attr: string): string {
    const element = $el.find(selector).first();
    return element.length > 0 ? (element.attr(attr) || '') : '';
  }

  private isLocationText(text: string): boolean {
  const locations = [
    'Australia', 'Brazil', 'Canada', 'Denmark', 'Finland', 'France', 'Germany',
    'India', 'Indonesia', 'Japan', 'Kenya', 'Korea', 'Malaysia', 'Netherlands',
    'Nigeria', 'Norway', 'Saudi Arabia', 'Singapore', 'Sweden', 'UK', 'US',
    'United Arab Emirates', 'Vietnam', 'Spain', 'Portugal'
  ];
    return locations.some(location => text.toLowerCase().includes(location.toLowerCase()));
  }

  private isSectorText(text: string): boolean {
    const sectors = [
        'Energy and ClimateTech', 'Climate', 'B2B Software', 'ConsumerTech', 'FinTech', 
        'Health and BioTech', 'Real Estate and PropTech','Industrials'
    ];
    
    // Check if text matches common sector patterns
    return sectors.some(sector => text.toLowerCase().includes(sector.toLowerCase())) ||
           text.toLowerCase().includes('tech') ||
           text.toLowerCase().includes('software') ||
           text.toLowerCase().includes('service') ||
           text.toLowerCase().includes('platform') ||
           text.match(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/) !== null; // Proper case words
  }

  private async savePageCompanies(pageCompanies: AntlerCompany[]): Promise<void> {
    // Only update aggregate files, individual company files will be saved at the end
    const outputDir = this.config.outputDir;
    writeJsonFile(`${outputDir}/all.json`, this.companies);
    
    const stats = generateCompanyStats(this.companies);
    writeJsonFile(`./meta.json`, stats);
    
    logProgress(`Processed ${pageCompanies.length} companies from current page`);
  }

  private async generateOutputFiles(): Promise<void> {
    logProgress('Generating output files...');
    
    const outputDir = this.config.outputDir;
    
    writeJsonFile(`${outputDir}/all.json`, this.companies);
    
    const stats = generateCompanyStats(this.companies);
    writeJsonFile(`./meta.json`, stats);
    
    for (const company of this.companies) {
      writeJsonFile(`${outputDir}/${company.slug}.json`, company);
      logProgress(`Saved ${company.name} (${company.slug})`);
    }
    
    this.generateSectorFiles();
    
    logProgress(`Generated ${this.companies.length} individual company files`);
  }

  private generateSectorFiles(): void {
    const sectorGroups: Record<string, AntlerCompany[]> = {};
    
    this.companies.forEach(company => {
      const sectorSlug = createSlug(company.sector);
      if (!sectorGroups[sectorSlug]) {
        sectorGroups[sectorSlug] = [];
      }
      sectorGroups[sectorSlug].push(company);
    });

    Object.entries(sectorGroups).forEach(([sector, companies]) => {
      writeJsonFile(`./industries/${sector}.json`, companies);
    });
  }


  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  getProgress(): ScrapingProgress {
    return this.progress;
  }

  getCompanies(): AntlerCompany[] {
    return this.companies;
  }
}

async function main() {
  const scraper = new AntlerPortfolioScraper();
  
  try {
    await scraper.init();
    await scraper.scrapePortfolio();
    
    const progress = scraper.getProgress();
    logProgress(`Scraping completed! Total companies: ${progress.totalCompanies}`);
    
  } catch (error) {
    logProgress(`Scraping failed: ${error}`);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}