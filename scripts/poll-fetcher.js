#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
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

class PollFetcher {
  constructor() {
    this.parser = new Parser();
    this.rssUrl = 'https://www.pollofpolls.no/rss_maling.php';
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async fetchRSSFeed() {
    try {
      console.log('Fetching RSS feed from pollofpolls.no...');
      const feed = await this.parser.parseURL(this.rssUrl);
      console.log(`Found ${feed.items.length} polls in RSS feed`);
      return feed.items;
    } catch (error) {
      console.error('Error fetching RSS feed:', error.message);
      throw error;
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

  filterPollsFor24Months(polls, electionDate) {
    const twentyFourMonthsBefore = new Date(electionDate);
    twentyFourMonthsBefore.setMonth(twentyFourMonthsBefore.getMonth() - 24);
    
    return polls.filter(poll => {
      return poll.date && poll.date >= twentyFourMonthsBefore && poll.date <= electionDate;
    });
  }

  async processPollsForElection(allPolls, electionYear) {
    const electionDate = ELECTION_DATES[electionYear];
    if (!electionDate) return [];

    console.log(`Processing polls for ${electionYear} election...`);
    
    const processedPolls = [];
    
    for (const rssItem of allPolls) {
      // Only process polls for parliamentary elections (stortingsvalg) and national polls (hele landet)
      if (!rssItem.title.includes('stortingsvalg') || !rssItem.title.includes('hele landet')) {
        continue;
      }
      
      console.log(`Processing: ${rssItem.title}`);
      
      const pollDetails = await this.fetchPollDetails(rssItem.link);
      
      if (pollDetails && pollDetails.date && pollDetails.mdgPercentage !== null) {
        const daysUntilElection = this.calculateDaysUntilElection(pollDetails.date, electionDate);
        
        // Only include polls within 24 months (730 days) before election
        if (daysUntilElection >= 0 && daysUntilElection <= 730) {
          processedPolls.push({
            date: pollDetails.date.toISOString().split('T')[0],
            mdgPercentage: pollDetails.mdgPercentage,
            pollster: pollDetails.pollster,
            daysUntilElection: daysUntilElection,
            rssTitle: rssItem.title,
            url: pollDetails.url
          });
          console.log(`  ✓ Added MDG ${pollDetails.mdgPercentage}% (${pollDetails.date.toISOString().split('T')[0]})`);
        }
      }

      // Add delay to be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return processedPolls.sort((a, b) => new Date(a.date) - new Date(b.date));
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
      console.log('Starting poll fetcher...');
      
      // Load existing data
      const existingData = await this.loadExistingData();
      
      // Fetch RSS feed
      const rssItems = await this.fetchRSSFeed();
      
      // Process polls for multiple election cycles
      const currentYear = new Date().getFullYear();
      const electionYears = [2021, 2025]; // Focus on recent elections
      
      // If we're past 2025, add future elections
      if (currentYear > 2025) {
        const nextElection = Math.ceil(currentYear / 4) * 4 + 1;
        electionYears.push(nextElection);
      }

      console.log(`Processing election years: ${electionYears.join(', ')}`);
      
      // Process polls for each election year
      for (const electionYear of electionYears) {
        console.log(`\n=== Processing ${electionYear} Election ===`);
        const polls = await this.processPollsForElection(rssItems, electionYear);
        
        if (polls.length > 0) {
          existingData.elections[electionYear] = {
            electionDate: ELECTION_DATES[electionYear].toISOString().split('T')[0],
            polls: polls
          };
          
          console.log(`✓ Found ${polls.length} MDG polls for ${electionYear} election`);
        } else {
          console.log(`✗ No MDG polls found for ${electionYear} election in recent RSS feed`);
        }
      }
      
      // Save updated data
      this.saveData(existingData);
      
      console.log('\n=== Poll fetcher completed successfully! ===');
      
    } catch (error) {
      console.error('Error in poll fetcher:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fetcher = new PollFetcher();
  fetcher.run();
}

module.exports = PollFetcher;
