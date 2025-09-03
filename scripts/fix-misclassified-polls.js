#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class MisclassifiedPollFixer {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
  }

  async verifyPollScope(pollUrl) {
    try {
      const response = await axios.get(pollUrl);
      const $ = cheerio.load(response.data);
      
      const pageText = $('body').text().toLowerCase();
      
      // Method 1: Check for the "Område" table row (most reliable)
      let scope = 'unknown';
      let region = null;
      
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
      
      // Method 2: Check for Oslo-specific indicators in article links
      if (scope === 'unknown') {
        if (pageText.includes('oslo-måling') || pageText.includes('oslo måling')) {
          scope = 'regional';
          region = 'Oslo';
        }
      }
      
      return { scope, region };
      
    } catch (error) {
      console.error(`Error verifying ${pollUrl}: ${error.message}`);
      return { scope: 'unknown', region: null };
    }
  }

  async fixMisclassifiedPolls() {
    console.log('🔧 Fixing misclassified polls by checking actual poll pages...');
    
    // Load the full dataset (not just the public one)
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    
    // Focus on polls above 6% as they're most likely to be misclassified Oslo polls
    const suspiciousPolls = [];
    Object.entries(data.elections).forEach(([year, election]) => {
      election.polls.forEach((poll, index) => {
        if (poll.mdgPercentage > 6 || (poll.scope === 'national' && poll.mdgPercentage > 5)) {
          suspiciousPolls.push({
            ...poll,
            year,
            index
          });
        }
      });
    });
    
    console.log(`Checking ${suspiciousPolls.length} suspicious polls...\\n`);
    
    let fixed = 0;
    let verified = 0;
    
    for (const poll of suspiciousPolls.slice(0, 20)) { // Limit to avoid overwhelming the server
      console.log(`Verifying: ${poll.mdgPercentage}% - ${poll.year} - ${poll.pollster.substring(0, 50)}...`);
      
      const verification = await this.verifyPollScope(poll.url);
      verified++;
      
      if (verification.scope !== 'unknown' && verification.scope !== poll.scope) {
        // Find and update the poll in the dataset
        const electionPolls = data.elections[poll.year].polls;
        const pollToUpdate = electionPolls.find(p => p.url === poll.url);
        
        if (pollToUpdate) {
          console.log(`  🔧 FIXING: ${poll.scope} → ${verification.scope} ${verification.region || ''}`);
          pollToUpdate.scope = verification.scope;
          if (verification.region) {
            pollToUpdate.region = verification.region;
          } else {
            delete pollToUpdate.region;
          }
          fixed++;
        }
      } else if (verification.scope !== 'unknown') {
        console.log(`  ✅ Correct: ${verification.scope}`);
      } else {
        console.log(`  ❓ Could not verify`);
      }
      
      // Be respectful to server
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Save the fixed dataset
    this.saveData(data);
    
    console.log(`\\n=== FIXING COMPLETE ===`);
    console.log(`Polls verified: ${verified}`);
    console.log(`Polls fixed: ${fixed}`);
    
    return { verified, fixed };
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
        
        console.log(`${year}: ${nationalPolls.length} national polls (removed ${election.polls.length - nationalPolls.length} regional)`);
      }
    });
    
    // Update public directory
    const publicDataDir = path.join(__dirname, '..', 'public', 'data');
    fs.writeFileSync(path.join(publicDataDir, 'polling-data.json'), JSON.stringify(nationalData, null, 2));
    
    // Update src fallback data
    fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'polling-data.json'), JSON.stringify(nationalData, null, 2));
    
    console.log('✅ Updated public and src data files with clean national polls');
    
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
      const results = await this.fixMisclassifiedPolls();
      await this.createCleanNationalDataset();
      
      if (results.fixed > 0) {
        console.log(`\\n✅ Fixed ${results.fixed} misclassified polls!`);
        console.log('The national polling dataset is now clean and accurate.');
      } else {
        console.log('\\n✅ No misclassified polls found!');
      }
      
    } catch (error) {
      console.error('❌ Error in misclassified poll fixer:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fixer = new MisclassifiedPollFixer();
  fixer.run();
}

module.exports = MisclassifiedPollFixer;
