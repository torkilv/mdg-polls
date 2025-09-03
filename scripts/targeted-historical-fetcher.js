#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Norwegian election dates
const ELECTION_DATES = {
  2017: new Date('2017-09-11'),
  2021: new Date('2021-09-13'),
};

class TargetedHistoricalFetcher {
  constructor() {
    this.baseUrl = 'https://www.pollofpolls.no';
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async searchPolls(searchTerm, maxResults = 50) {
    try {
      // Try to search for polls using the search functionality
      const searchUrl = `${this.baseUrl}/?cmd=Sok&q=${encodeURIComponent(searchTerm)}`;
      console.log(`Searching for: ${searchTerm}`);
      
      const response = await axios.get(searchUrl);
      const $ = cheerio.load(response.data);
      
      const pollLinks = [];
      
      // Look for poll links in search results
      $('a[href*="gallupid="]').each((i, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('gallupid=')) {
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}/${href}`;
          pollLinks.push(fullUrl);
        }
      });
      
      return pollLinks.slice(0, maxResults);
    } catch (error) {
      console.error(`Error searching for polls: ${error.message}`);
      return [];
    }
  }

  async fetchPollDetails(pollUrl) {
    try {
      const response = await axios.get(pollUrl);
      const $ = cheerio.load(response.data);
      
      // Extract poll date using multiple methods
      let pollDate = null;
      
      // Method 1: Norwegian date format
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

      // Extract MDG percentage
      let mdgPercentage = null;
      
      // Check URL parameters and script tags
      const mandateLinks = $('a[href*="MDG="]');
      mandateLinks.each((i, element) => {
        const href = $(element).attr('href');
        const mdgMatch = href.match(/MDG=([0-9.]+)/);
        if (mdgMatch && !mdgPercentage) {
          mdgPercentage = parseFloat(mdgMatch[1]);
        }
      });

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
      const pollster = title.replace('pollofpolls.no - ', '').trim();

      return {
        date: pollDate,
        mdgPercentage,
        pollster,
        url: pollUrl
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

  async fetchRealHistoricalData() {
    console.log('Fetching real historical polling data...');
    
    const existingData = await this.loadExistingData();
    
    // Search terms for finding historical polls
    const searchTerms = [
      'MDG stortingsvalg',
      'Miljøpartiet hele landet',
      'Norstat MDG',
      'Kantar MDG',
      'Opinion MDG',
      'Sentio MDG',
      'Respons MDG'
    ];

    const allPolls = new Map(); // Use Map to avoid duplicates

    for (const searchTerm of searchTerms) {
      console.log(`\n--- Searching for: ${searchTerm} ---`);
      
      const pollLinks = await this.searchPolls(searchTerm, 20);
      console.log(`Found ${pollLinks.length} potential polls`);
      
      for (const pollUrl of pollLinks) {
        const pollDetails = await this.fetchPollDetails(pollUrl);
        
        if (pollDetails && pollDetails.date && pollDetails.mdgPercentage !== null) {
          // Determine which election this poll belongs to
          let targetElection = null;
          
          for (const [year, electionDate] of Object.entries(ELECTION_DATES)) {
            const daysUntilElection = this.calculateDaysUntilElection(pollDetails.date, electionDate);
            
            // Include polls within 24 months before election
            if (daysUntilElection >= 0 && daysUntilElection <= 730) {
              targetElection = { year, electionDate, daysUntilElection };
              break;
            }
          }
          
          if (targetElection) {
            const pollKey = `${pollDetails.date.toISOString()}_${pollDetails.mdgPercentage}`;
            
            if (!allPolls.has(pollKey)) {
              allPolls.set(pollKey, {
                date: pollDetails.date.toISOString().split('T')[0],
                mdgPercentage: pollDetails.mdgPercentage,
                pollster: pollDetails.pollster,
                daysUntilElection: targetElection.daysUntilElection,
                url: pollDetails.url,
                electionYear: targetElection.year
              });
              
              console.log(`  ✓ Found MDG ${pollDetails.mdgPercentage}% for ${targetElection.year} (${pollDetails.date.toISOString().split('T')[0]})`);
            }
          }
        }
        
        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Delay between search terms
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Organize polls by election year
    const pollsByElection = {};
    for (const poll of allPolls.values()) {
      if (!pollsByElection[poll.electionYear]) {
        pollsByElection[poll.electionYear] = [];
      }
      pollsByElection[poll.electionYear].push(poll);
    }

    // Update existing data with real historical data
    for (const [year, polls] of Object.entries(pollsByElection)) {
      if (polls.length > 0) {
        const sortedPolls = polls.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        existingData.elections[year] = {
          electionDate: ELECTION_DATES[year].toISOString().split('T')[0],
          polls: sortedPolls
        };
        
        console.log(`\n✓ Updated ${year} election with ${sortedPolls.length} real polls`);
      }
    }

    // Save the updated data
    this.saveData(existingData);
    
    // Also copy to public directory
    const publicDataDir = path.join(__dirname, '..', 'public', 'data');
    if (!fs.existsSync(publicDataDir)) {
      fs.mkdirSync(publicDataDir, { recursive: true });
    }
    fs.writeFileSync(path.join(publicDataDir, 'polling-data.json'), JSON.stringify(existingData, null, 2));
    
    console.log('\n=== Real historical data fetching completed! ===');
    console.log(`Total unique polls found: ${allPolls.size}`);
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
      await this.fetchRealHistoricalData();
    } catch (error) {
      console.error('Error in targeted historical fetcher:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fetcher = new TargetedHistoricalFetcher();
  fetcher.run();
}

module.exports = TargetedHistoricalFetcher;
