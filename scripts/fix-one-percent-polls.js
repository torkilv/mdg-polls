#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class OnePercentPollFixer {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
  }

  async verifyOnePercentPoll(pollUrl) {
    try {
      const response = await axios.get(pollUrl);
      const $ = cheerio.load(response.data);
      
      const pageText = $('body').text().toLowerCase();
      
      // Method 1: Check for the "Område" table row
      let scope = 'unknown';
      let region = null;
      let actualMDGPercentage = null;
      
      $('tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const firstCell = $(cells[0]).text().toLowerCase().trim();
          const secondCell = $(cells[1]).text().toLowerCase().trim();
          
          if (firstCell === 'område' || firstCell === 'area') {
            if (secondCell.includes('hele landet')) {
              scope = 'national';
              region = null;
            } else {
              scope = 'regional';
              region = secondCell.charAt(0).toUpperCase() + secondCell.slice(1);
            }
          }
        }
      });
      
      // Method 2: Try to find the actual MDG percentage from the table
      $('table').each((i, table) => {
        const $table = $(table);
        
        // Look for MDG header
        let mdgColumnIndex = -1;
        $table.find('th').each((j, th) => {
          const headerText = $(th).text().trim();
          if (headerText === 'MDG' || headerText.toLowerCase().includes('miljøpartiet')) {
            mdgColumnIndex = j;
          }
        });
        
        if (mdgColumnIndex >= 0) {
          // Find the data row with percentages
          $table.find('tr').each((k, row) => {
            const cells = $(row).find('td');
            if (cells.length > mdgColumnIndex) {
              const cellText = $(cells[mdgColumnIndex]).text().trim();
              const percentage = parseFloat(cellText.replace('%', '').replace(',', '.'));
              
              if (!isNaN(percentage) && percentage > 0) {
                actualMDGPercentage = percentage;
              }
            }
          });
        }
      });
      
      // Method 3: Check mandate calculation URLs for MDG percentage
      if (!actualMDGPercentage) {
        $('a[href*="MDG="]').each((i, link) => {
          const href = $(link).attr('href');
          const mdgMatch = href.match(/MDG=([0-9.]+)/);
          if (mdgMatch) {
            const percentage = parseFloat(mdgMatch[1]);
            if (!isNaN(percentage)) {
              actualMDGPercentage = percentage;
            }
          }
        });
      }
      
      return { scope, region, actualMDGPercentage };
      
    } catch (error) {
      console.error(`Error verifying ${pollUrl}: ${error.message}`);
      return { scope: 'unknown', region: null, actualMDGPercentage: null };
    }
  }

  async fixOnePercentPolls() {
    console.log('🔍 Checking all polls with exactly 1% MDG support...');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    
    // Find all 1% polls
    const onePercentPolls = [];
    
    Object.entries(data.elections).forEach(([year, election]) => {
      election.polls.forEach((poll, index) => {
        if (poll.mdgPercentage === 1) {
          onePercentPolls.push({ ...poll, year, index });
        }
      });
    });
    
    console.log(`Found ${onePercentPolls.length} polls with exactly 1% MDG support\\n`);
    
    let verified = 0;
    let reclassified = 0;
    let percentageCorrected = 0;
    let removed = 0;
    
    // Check each 1% poll
    for (const poll of onePercentPolls) {
      console.log(`Verifying: 1% - ${poll.year} - ${poll.date} - ${poll.pollster.substring(0, 60)}...`);
      
      const verification = await this.verifyOnePercentPoll(poll.url);
      verified++;
      
      // Find the poll in the dataset
      const electionPolls = data.elections[poll.year].polls;
      const pollToUpdate = electionPolls.find(p => p.url === poll.url);
      
      if (!pollToUpdate) {
        console.log(`  ❓ Poll not found in dataset`);
        continue;
      }
      
      let updated = false;
      
      // Check if it's a regional poll that should be removed
      if (verification.scope === 'regional') {
        console.log(`  🚨 REGIONAL POLL - removing: ${verification.region || 'unknown region'}`);
        const pollIndex = electionPolls.findIndex(p => p.url === poll.url);
        if (pollIndex >= 0) {
          electionPolls.splice(pollIndex, 1);
          removed++;
          updated = true;
        }
      }
      // Check if the percentage is wrong
      else if (verification.actualMDGPercentage && verification.actualMDGPercentage !== 1) {
        console.log(`  🔧 CORRECTING PERCENTAGE: 1% → ${verification.actualMDGPercentage}%`);
        pollToUpdate.mdgPercentage = verification.actualMDGPercentage;
        percentageCorrected++;
        updated = true;
      }
      // Check if scope needs updating
      else if (verification.scope === 'national' && pollToUpdate.scope !== 'national') {
        console.log(`  ✅ Confirmed national, updating scope`);
        pollToUpdate.scope = 'national';
        if (pollToUpdate.region) delete pollToUpdate.region;
        reclassified++;
        updated = true;
      }
      else if (verification.scope === 'national') {
        console.log(`  ✅ Confirmed national with 1%`);
      }
      else {
        console.log(`  ❓ Could not verify (${verification.scope})`);
      }
      
      if (!updated) {
        // Check if it's a party-commissioned poll that might be biased
        const pollster = poll.pollster.toLowerCase();
        if (pollster.includes('for høyre') || 
            pollster.includes('for venstre') || 
            pollster.includes('for frp') ||
            pollster.includes('for arbeiderpartiet') ||
            pollster.includes('for senterpartiet')) {
          console.log(`  🤔 Party-commissioned poll - might be biased`);
        }
      }
      
      // Be respectful to server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save updated data
    this.saveData(data);
    
    console.log(`\\n=== ONE PERCENT POLL FIX RESULTS ===`);
    console.log(`Polls verified: ${verified}`);
    console.log(`Regional polls removed: ${removed}`);
    console.log(`Percentages corrected: ${percentageCorrected}`);
    console.log(`Scope reclassified: ${reclassified}`);
    
    return { verified, removed, percentageCorrected, reclassified };
  }

  async createCleanNationalDataset() {
    console.log('\\n=== Creating Clean National Dataset ===');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    const nationalData = { elections: {} };
    
    Object.entries(data.elections).forEach(([year, election]) => {
      const nationalPolls = election.polls.filter(poll => poll.scope === 'national');
      
      if (nationalPolls.length > 0) {
        nationalData.elections[year] = {
          ...election,
          polls: nationalPolls
        };
        
        const removed = election.polls.length - nationalPolls.length;
        console.log(`${year}: ${nationalPolls.length} national polls (removed ${removed} regional)`);
      }
    });
    
    // Update public directory
    const publicDataDir = path.join(__dirname, '..', 'public', 'data');
    fs.writeFileSync(path.join(publicDataDir, 'polling-data.json'), JSON.stringify(nationalData, null, 2));
    
    // Update src fallback data
    fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'polling-data.json'), JSON.stringify(nationalData, null, 2));
    
    console.log('✅ Updated public and src data files with corrected polls');
    
    return nationalData;
  }

  saveData(data) {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving data:', error.message);
      throw error;
    }
  }

  async run() {
    try {
      const results = await this.fixOnePercentPolls();
      await this.createCleanNationalDataset();
      
      console.log(`\\n✅ One percent poll fix complete!`);
      console.log(`Removed ${results.removed} regional polls and corrected ${results.percentageCorrected} percentages.`);
      
    } catch (error) {
      console.error('❌ Error in one percent poll fixer:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fixer = new OnePercentPollFixer();
  fixer.run();
}

module.exports = OnePercentPollFixer;
