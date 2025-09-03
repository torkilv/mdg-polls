#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Norwegian election dates
const ELECTION_DATES = {
  2013: new Date('2013-09-09'),
  2017: new Date('2017-09-11'),
  2021: new Date('2021-09-13'),
  2025: new Date('2025-09-08')
};

class PollUpdater {
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
      
      // Check if poll exists (look for error message)
      if ($('body').text().includes('Meningsmålingen eksisterer ikke i databasen')) {
        return null;
      }
      
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

  findHighestPollId(existingData) {
    let highestId = 0;
    
    Object.values(existingData.elections).forEach(election => {
      election.polls.forEach(poll => {
        const urlMatch = poll.url.match(/gallupid=(\d+)/);
        if (urlMatch) {
          const id = parseInt(urlMatch[1]);
          if (id > highestId) {
            highestId = id;
          }
        }
      });
    });
    
    return highestId;
  }

  determineElectionYear(pollDate) {
    // Determine which election this poll belongs to based on proximity
    // Polls belong to the election cycle they are within 24 months of
    
    if (pollDate < ELECTION_DATES[2013]) return null; // Before our tracking period
    
    // Calculate distance to each election
    const distances = {};
    Object.entries(ELECTION_DATES).forEach(([year, electionDate]) => {
      const timeDiff = Math.abs(electionDate.getTime() - pollDate.getTime());
      const daysDiff = timeDiff / (1000 * 3600 * 24);
      distances[year] = daysDiff;
    });
    
    // Find the closest election
    let closestYear = null;
    let closestDistance = Infinity;
    
    Object.entries(distances).forEach(([year, distance]) => {
      if (distance < closestDistance) {
        closestDistance = distance;
        closestYear = year;
      }
    });
    
    // Only return if within 24 months (730 days) of the closest election
    if (closestDistance <= 730) {
      return parseInt(closestYear);
    }
    
    return null;
  }

  async fetchNewPolls(startId, maxChecks = 100) {
    console.log(`🔍 Checking for new polls starting from ID ${startId}...`);
    
    const newPolls = [];
    let consecutiveNonExistent = 0;
    const maxConsecutiveNonExistent = 30; // Stop if we hit 30 consecutive non-existent polls
    
    for (let id = startId; id <= startId + maxChecks && consecutiveNonExistent < maxConsecutiveNonExistent; id++) {
      const pollUrl = `${this.baseUrl}/?cmd=Maling&gallupid=${id}`;
      const pollDetails = await this.fetchPollDetails(pollUrl);
      
      // Check if poll exists at all
      if (!pollDetails) {
        consecutiveNonExistent++;
        console.log(`  - Poll ID ${id}: Not found (${consecutiveNonExistent}/${maxConsecutiveNonExistent})`);
      } else {
        consecutiveNonExistent = 0; // Reset counter when we find an existing poll
        
        if (pollDetails.date && pollDetails.mdgPercentage !== null) {
          const electionYear = this.determineElectionYear(pollDetails.date);
          
          if (electionYear) {
            const electionDate = ELECTION_DATES[electionYear];
            const daysUntilElection = this.calculateDaysUntilElection(pollDetails.date, electionDate);
            
            // Only include polls within 24 months before election
            if (daysUntilElection >= 0 && daysUntilElection <= 730) {
              const poll = {
                date: pollDetails.date.toISOString().split('T')[0],
                mdgPercentage: pollDetails.mdgPercentage,
                pollster: pollDetails.pollster,
                daysUntilElection: daysUntilElection,
                url: pollDetails.url,
                scope: pollDetails.scope
              };
              
              newPolls.push({ electionYear, poll });
              console.log(`  ✓ Found new MDG ${pollDetails.mdgPercentage}% (${poll.date}) - ${pollDetails.scope.toUpperCase()} - ${pollDetails.pollster}`);
            } else {
              console.log(`  - Poll ID ${id}: Outside 24-month window (${daysUntilElection} days)`);
            }
          } else {
            console.log(`  - Poll ID ${id}: Before tracking period`);
          }
        } else {
          console.log(`  - Poll ID ${id}: No MDG data or invalid date`);
        }
      }
      
      // Add delay between requests to be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`📊 Found ${newPolls.length} new MDG polls`);
    return newPolls;
  }

  async run() {
    try {
      console.log('🔄 Starting poll update...\n');
      
      // Load existing data
      const existingData = await this.loadExistingData();
      
      // Find the highest poll ID we already have
      const highestId = this.findHighestPollId(existingData);
      console.log(`📈 Highest existing poll ID: ${highestId}`);
      
      if (highestId === 0) {
        console.log('❌ No existing polls found. Run npm run fetch-historical first.');
        process.exit(1);
      }
      
      // Fetch new polls starting from the next ID
      const newPolls = await this.fetchNewPolls(highestId + 1);
      
      if (newPolls.length === 0) {
        console.log('✅ No new polls found. Data is up to date!');
        return;
      }
      
      // Add new polls to existing data
      let addedCount = 0;
      newPolls.forEach(({ electionYear, poll }) => {
        if (!existingData.elections[electionYear]) {
          existingData.elections[electionYear] = {
            electionDate: ELECTION_DATES[electionYear].toISOString().split('T')[0],
            polls: []
          };
          
          // Add actual result if we have it
          const actualResults = { 2013: 2.8, 2017: 3.2, 2021: 3.9 };
          if (actualResults[electionYear]) {
            existingData.elections[electionYear].actualResult = actualResults[electionYear];
          }
        }
        
        // Check if poll already exists (by URL)
        const exists = existingData.elections[electionYear].polls.some(p => p.url === poll.url);
        if (!exists) {
          existingData.elections[electionYear].polls.push(poll);
          addedCount++;
        }
      });
      
      if (addedCount > 0) {
        // Sort polls by date within each election
        Object.keys(existingData.elections).forEach(year => {
          existingData.elections[year].polls.sort((a, b) => new Date(a.date) - new Date(b.date));
        });
        
        // Save updated data
        this.saveData(existingData);
        console.log(`\n✅ Added ${addedCount} new polls to the dataset`);
        console.log('🔄 Now run: npm run sync-data');
      } else {
        console.log('ℹ️  All new polls were duplicates, no data updated.');
      }
      
    } catch (error) {
      console.error('❌ Error updating polls:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const updater = new PollUpdater();
  updater.run();
}

module.exports = PollUpdater;
