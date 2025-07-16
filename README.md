# Antler Portfolio API

An unofficial API for accessing Antler's portfolio companies data. This project scrapes the official Antler portfolio website to create a structured API for developers.

## 🚀 Features

- **Complete Company Data**: Name, description, location, sector, founding year, and more
- **Multiple Endpoints**: Access companies by sector or individual company
- **TypeScript Support**: Full type definitions included
- **Resume Capability**: Checkpoint system for interrupted scraping
- **Statistics**: Company distribution analytics

## 📊 API Endpoints

### Base URL
```
https://your-domain.github.io/antler-api/
```

### Available Endpoints

| Endpoint | Description |
|----------|-------------|
| `/companies/all.json` | All companies |
| `/companies/{slug}.json` | Individual company |
| `/industries/{sector}.json` | Companies by sector |
| `/meta.json` | Statistics and metadata |

## 🏗️ Project Structure

```
antler-portfolio-api/
├── src/
│   ├── fetcher.ts          # Main scraping logic
│   ├── types.ts            # TypeScript interfaces
│   └── utils.ts            # Utility functions
├── companies/              # Generated company files
├── industries/             # Sector-based collections
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/your-username/antler-portfolio-api.git
cd antler-portfolio-api

# Install dependencies
npm install

# Build the project
npm run build
```

## 🔧 Usage

### Run the Scraper

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start

# Or directly
npm run scrape
```

### Configuration

The scraper can be configured by modifying the `ScrapingConfig` in `src/fetcher.ts`:

```typescript
const config: ScrapingConfig = {
  baseUrl: 'https://www.antler.co/portfolio',
  maxPages: 20,
  delay: 2000,
  retryAttempts: 3,
  outputDir: './companies'
};
```

## 📝 Data Structure

### AntlerCompany Interface

```typescript
interface AntlerCompany {
  id: string;              // Unique identifier
  name: string;            // Company name
  slug: string;            // URL-friendly name
  website: string;         // Company website
  description: string;     // Company description
  founded_year: number;    // Year founded
  location: string;        // City/region
  sector: string;          // Industry sector
  logo_url: string;        // Logo image URL
  url: string;             // Antler portfolio URL
  api: string;             // API endpoint URL
}
```

### Example Response

```json
{
  "id": "antler-example-company",
  "name": "Example Company",
  "slug": "example-company",
  "website": "https://example.com",
  "description": "An innovative startup solving real-world problems.",
  "founded_year": 2023,
  "location": "London",
  "sector": "Technology",
  "logo_url": "https://example.com/logo.png",
  "url": "https://www.antler.co/portfolio/example-company",
  "api": "https://your-domain.github.io/companies/example-company.json"
}
```

## 🔍 API Usage Examples

### Fetch All Companies

```javascript
const response = await fetch('https://your-domain.github.io/companies/all.json');
const companies = await response.json();
console.log(`Total companies: ${companies.length}`);
```

### Fetch Companies by Sector

```javascript
const response = await fetch('https://your-domain.github.io/industries/fintech.json');
const fintechCompanies = await response.json();
```

### Fetch Company Statistics

```javascript
const response = await fetch('https://your-domain.github.io/meta.json');
const stats = await response.json();
console.log(`Total companies: ${stats.totalCompanies}`);
```

## 🔄 Automation

The scraper is designed to be run manually every 3 months to update the data. You can set up a GitHub Actions workflow for automated updates:

```yaml
name: Update Portfolio Data
on:
  schedule:
    - cron: '0 0 1 */3 *'  # Run quarterly
  workflow_dispatch:  # Allow manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run scrape
      - run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add -A
          git commit -m "Update portfolio data" || exit 0
          git push
```

## 📈 Statistics

The API provides comprehensive statistics including:

- Total number of companies
- Sector distribution
- Founding year distribution
- Last updated timestamp

## 🛡️ Rate Limiting

The scraper includes built-in rate limiting and retry mechanisms:

- 2-second delays between requests
- 3 retry attempts for failed requests
- Respectful scraping practices

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## ⚠️ Disclaimer

This is an unofficial API created for educational and development purposes. The data is scraped from publicly available sources. Please respect Antler's terms of service and use this responsibly.

## 🔗 Links

- [Antler Official Website](https://www.antler.co)
- [Antler Portfolio](https://www.antler.co/portfolio)
- [GitHub Issues](https://github.com/your-username/antler-portfolio-api/issues)