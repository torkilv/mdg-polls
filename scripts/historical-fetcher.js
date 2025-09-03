#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Norwegian election dates
const ELECTION_DATES = {
  2011: new Date('2011-09-12'),
  2013: new Date('2013-09-09'), 
  2017: new Date('2017-09-11'),
  2021: new Date('2021-09-13'),
  2025: new Date('2025-09-08')
};

class HistoricalFetcher {
  constructor() {
    this.baseUrl = 'https://www.pollofpolls.no';
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async fetchPollDetails(pollUrl) {
    try {
      const response = await axios.get(pollUrl);
      const $ = cheerio.load(response.data);
      
      // Extract poll date from the page - try multiple methods
      let pollDate = null;
      
      // Method 1: Look for date in blockquote
      const dateText = $('blockquote').first().text();
      const dateMatch1 = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      
      if (dateMatch1) {
        const [, day, month, year] = dateMatch1;
        pollDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      }
      
      // Method 2: Look for Norwegian date format (e.g., "27. august 2025")
      if (!pollDate) {
        const norwegianMonths = {
          'januar': '01', 'februar': '02', 'mars': '03', 'april': '04',
          'mai': '05', 'juni': '06', 'juli': '07', 'august': '08',
          'september': '09', 'oktober': '10', 'november': '11', 'desember': '12'
        };
        
        const pageText = $('body').text();
        const norwegianDateMatch = pageText.match(/(\d{1,2})\.\s*(\w+)\s*(\d{4})/i);
        
        if (norwegianDateMatch) {
          const [, day, monthName, year] = norwegianDateMatch;
          const monthNum = norwegianMonths[monthName.toLowerCase()];
          if (monthNum) {
            pollDate = new Date(`${year}-${monthNum}-${day.padStart(2, '0')}`);
          }
        }
      }
      
      // Method 3: Extract from title or other elements
      if (!pollDate) {
        const title = $('title').text();
        const titleDateMatch = title.match(/(\d{1,2})\.\s*(\w+)\s*(\d{4})/i);
        if (titleDateMatch) {
          const norwegianMonths = {
            'januar': '01', 'februar': '02', 'mars': '03', 'april': '04',
            'mai': '05', 'juni': '06', 'juli': '07', 'august': '08',
            'september': '09', 'oktober': '10', 'november': '11', 'desember': '12'
          };
          const [, day, monthName, year] = titleDateMatch;
          const monthNum = norwegianMonths[monthName.toLowerCase()];
          if (monthNum) {
            pollDate = new Date(`${year}-${monthNum}-${day.padStart(2, '0')}`);
          }
        }
      }

      // Extract MDG percentage from URL parameters or page content
      let mdgPercentage = null;
      
      // Method 1: Check URL parameters in mandate calculation links
      const mandateLinks = $('a[href*="MDG="]');
      mandateLinks.each((i, element) => {
        const href = $(element).attr('href');
        const mdgMatch = href.match(/MDG=([0-9.]+)/);
        if (mdgMatch && !mdgPercentage) {
          mdgPercentage = parseFloat(mdgMatch[1]);
        }
      });

      // Method 2: Check script tags for MDG data
      if (!mdgPercentage) {
        $('script').each((i, element) => {
          const scriptContent = $(element).html();
          if (scriptContent && scriptContent.includes('MDG=')) {
            const mdgMatch = scriptContent.match(/MDG=([0-9.]+)/);
            if (mdgMatch) {
              mdgPercentage = parseFloat(mdgMatch[1]);
            }
          }
        });
      }

      // Extract pollster from title
      const title = $('title').text() || '';
      const pollsterMatch = title.match(/^([^,]+)/);
      const pollster = pollsterMatch ? pollsterMatch[1].trim() : 'Unknown';

      // Extract scope (national/regional) from the "Område" field in the facts table
      let scope = 'unknown';
      const factTable = $('h2:contains("Fakta om meningsmålingen")').next('div').find('table');
      factTable.find('tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim();
          const value = $(cells[1]).text().trim();
          
          if (label === 'Område') {
            if (value === 'Hele landet') {
              scope = 'national';
            } else {
              scope = 'regional';
            }
          }
        }
      });

      return {
        date: pollDate,
        mdgPercentage,
        pollster,
        url: pollUrl,
        scope: scope
      };
    } catch (error) {
      console.error(`Error fetching poll details from ${pollUrl}:`, error.message);
      return null;
    }
  }

  calculateDaysUntilElection(pollDate, electionDate) {
    const timeDiff = electionDate.getTime() - pollDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  async fetchHistoricalPolls(electionYear, startId = 1, endId = 6000) {
    const electionDate = ELECTION_DATES[electionYear];
    if (!electionDate) return [];

    console.log(`Fetching historical polls for ${electionYear} election (IDs ${startId}-${endId})`);
    
    const twentyFourMonthsBefore = new Date(electionDate);
    twentyFourMonthsBefore.setMonth(twentyFourMonthsBefore.getMonth() - 24);
    
    const polls = [];
    const batchSize = 10; // Smaller batches to be more respectful to the server
    
    for (let id = startId; id <= endId; id += batchSize) {
      console.log(`Processing poll IDs ${id}-${Math.min(id + batchSize - 1, endId)}...`);
      
      // Process sequentially instead of in parallel to reduce server load
      for (let batchId = id; batchId < id + batchSize && batchId <= endId; batchId++) {
        const pollUrl = `${this.baseUrl}/?cmd=Maling&gallupid=${batchId}`;
        const pollDetails = await this.fetchPollDetails(pollUrl);
        
        if (pollDetails && pollDetails.date && pollDetails.mdgPercentage !== null) {
          const daysUntilElection = this.calculateDaysUntilElection(pollDetails.date, electionDate);
          
          // Only include polls within 24 months before election and after previous election
          if (daysUntilElection >= 0 && daysUntilElection <= 730 && 
              pollDetails.date >= twentyFourMonthsBefore && 
              pollDetails.date <= electionDate) {
            
            polls.push({
              date: pollDetails.date.toISOString().split('T')[0],
              mdgPercentage: pollDetails.mdgPercentage,
              pollster: pollDetails.pollster,
              daysUntilElection: daysUntilElection,
              url: pollDetails.url,
              scope: pollDetails.scope
            });
            
            console.log(`  ✓ Found MDG ${pollDetails.mdgPercentage}% (${pollDetails.date.toISOString().split('T')[0]}) - ${pollDetails.scope.toUpperCase()} - ${pollDetails.pollster}`);
          }
        }
        
        // Add delay between each request
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Longer delay between batches to be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return polls.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async loadExistingData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading existing data:', error.message);
    }
    return { elections: {} };
  }

  saveData(data) {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
      console.log(`Data saved to ${this.dataFile}`);
    } catch (error) {
      console.error('Error saving data:', error.message);
      throw error;
    }
  }

  async run() {
    try {
      console.log('Starting historical poll fetcher...');
      
      // Load existing data
      const existingData = await this.loadExistingData();
      
      // Define ID ranges for different election periods (more targeted)
      const electionRanges = {
        2025: { start: 5240, end: 5600 }, // 2023-2025 polls
        2021: { start: 4041, end: 4532 }, // 2019-2021 polls
        2017: { start: 2900, end: 3315 }, // 2015-2017 polls  
        2013: { start: 1614, end: 2110 }, // 2011-2013 polls
      };
      
      // Process each election year
      for (const [electionYear, range] of Object.entries(electionRanges)) {
        console.log(`\n=== Processing ${electionYear} Election ===`);
        
        // Skip if we already have data for this election (unless forced)
        if (existingData.elections[electionYear] && existingData.elections[electionYear].polls.length > 5) {
          console.log(`Already have data for ${electionYear}, skipping...`);
          continue;
        }
        
        const polls = await this.fetchHistoricalPolls(parseInt(electionYear), range.start, range.end);
        
        if (polls.length > 0) {
          existingData.elections[electionYear] = {
            electionDate: ELECTION_DATES[electionYear].toISOString().split('T')[0],
            polls: polls
          };
          
          console.log(`✓ Found ${polls.length} historical MDG polls for ${electionYear} election`);
          
          // Save data after each election to avoid losing progress
          this.saveData(existingData);
        } else {
          console.log(`✗ No historical MDG polls found for ${electionYear} election`);
        }
      }
      
      console.log('\n=== Historical poll fetcher completed! ===');
      
    } catch (error) {
      console.error('Error in historical poll fetcher:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fetcher = new HistoricalFetcher();
  fetcher.run();
}

module.exports = HistoricalFetcher;
