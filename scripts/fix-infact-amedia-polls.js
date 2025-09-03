#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class InFactAmediaPollFixer {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
  }

  async verifyInFactAmediaPoll(pollUrl) {
    try {
      const response = await axios.get(pollUrl);
      const $ = cheerio.load(response.data);
      
      // Check for the "Område" table row
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
      
      return { scope, region };
      
    } catch (error) {
      console.error(`Error verifying ${pollUrl}: ${error.message}`);
      return { scope: 'unknown', region: null };
    }
  }

  async fixInFactAmediaPolls() {
    console.log('🔍 Fixing InFact for Amedia polls...');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    
    // Find all InFact for Amedia polls that are currently classified as national
    const infactAmediaPolls = [];
    
    Object.entries(data.elections).forEach(([year, election]) => {
      election.polls.forEach((poll, index) => {
        if (poll.pollster.toLowerCase().includes('infact') && 
            poll.pollster.toLowerCase().includes('amedia') &&
            poll.scope === 'national') {
          infactAmediaPolls.push({ ...poll, year, index });
        }
      });
    });
    
    console.log(`Found ${infactAmediaPolls.length} InFact for Amedia polls classified as national\\n`);
    
    let verified = 0;
    let reclassified = 0;
    
    // Check each poll
    for (const poll of infactAmediaPolls) {
      console.log(`Verifying: ${poll.mdgPercentage}% - ${poll.year} - ${poll.date} - ${poll.pollster.substring(0, 60)}...`);
      
      const verification = await this.verifyInFactAmediaPoll(poll.url);
      verified++;
      
      if (verification.scope === 'regional') {
        console.log(`  🔧 RECLASSIFYING: national → regional ${verification.region || ''}`);
        
        // Find and update the poll in the dataset
        const electionPolls = data.elections[poll.year].polls;
        const pollToUpdate = electionPolls.find(p => p.url === poll.url);
        
        if (pollToUpdate) {
          pollToUpdate.scope = 'regional';
          if (verification.region) {
            pollToUpdate.region = verification.region;
          }
          reclassified++;
        }
      } else if (verification.scope === 'national') {
        console.log(`  ✅ Correctly national`);
      } else {
        console.log(`  ❓ Could not verify (${verification.scope})`);
      }
      
      // Be respectful to server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save updated data
    this.saveData(data);
    
    console.log(`\\n=== INFACT AMEDIA POLL FIX RESULTS ===`);
    console.log(`Polls verified: ${verified}`);
    console.log(`Polls reclassified: ${reclassified}`);
    
    return { verified, reclassified };
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
    
    console.log('✅ Updated public and src data files with InFact-cleaned national polls');
    
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
      const results = await this.fixInFactAmediaPolls();
      await this.createCleanNationalDataset();
      
      if (results.reclassified > 0) {
        console.log(`\\n✅ InFact Amedia poll fix complete! Reclassified ${results.reclassified} regional polls.`);
        console.log('The charts will now exclude these northern regional polls from national trends.');
      } else {
        console.log('\\n✅ No InFact Amedia polls found to reclassify.');
      }
      
    } catch (error) {
      console.error('❌ Error in InFact Amedia poll fixer:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fixer = new InFactAmediaPollFixer();
  fixer.run();
}

module.exports = InFactAmediaPollFixer;
