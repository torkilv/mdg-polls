#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class SuspiciousPatternFixer {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
  }

  async verifyPollScope(pollUrl) {
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

  async fixSuspiciousPatterns() {
    console.log('🔍 Fixing suspicious polling patterns...');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    
    // Target suspicious polls:
    // 1. All 2% polls (likely municipal/regional)
    // 2. Clustered polls from same media on same date
    // 3. Polls from local newspapers/media
    
    const suspiciousPolls = [];
    
    Object.entries(data.elections).forEach(([year, election]) => {
      election.polls.forEach((poll, index) => {
        let suspicious = false;
        let reason = '';
        
        // Check for exact 2% (likely municipal polls)
        if (poll.mdgPercentage === 2 && poll.scope === 'national') {
          suspicious = true;
          reason = '2% exact (likely municipal)';
        }
        
        // Check for local newspaper indicators
        const pollster = poll.pollster.toLowerCase();
        const localIndicators = [
          'ringerikes blad', 'raumnes', 'bygdeposten', 'lofotposten', 
          'fredriksstad blad', 'hamar arbeiderblad', 'helgelendingen',
          'trønder-avisa', 'sandnesposten', 'gudbrandsdølen', 'nordlys',
          'avisa nordland', 'altaposten', 'østlands-posten'
        ];
        
        if (localIndicators.some(indicator => pollster.includes(indicator))) {
          suspicious = true;
          reason = 'local newspaper poll';
        }
        
        // Check for party-commissioned polls in specific regions (likely regional)
        if ((pollster.includes('for høyre') || pollster.includes('for venstre') || 
             pollster.includes('for arbeiderpartiet') || pollster.includes('for senterpartiet')) &&
            poll.scope === 'national') {
          suspicious = true;
          reason = 'party-commissioned poll';
        }
        
        if (suspicious) {
          suspiciousPolls.push({ ...poll, year, index, reason });
        }
      });
    });
    
    console.log(`Found ${suspiciousPolls.length} suspicious polls to verify\\n`);
    
    let verified = 0;
    let reclassified = 0;
    let removed = 0;
    
    // Check each suspicious poll
    for (const poll of suspiciousPolls.slice(0, 50)) { // Limit to avoid overwhelming server
      console.log(`Verifying: ${poll.mdgPercentage}% - ${poll.year} - ${poll.date} - ${poll.reason}`);
      console.log(`  ${poll.pollster.substring(0, 70)}...`);
      
      const verification = await this.verifyPollScope(poll.url);
      verified++;
      
      // Find the poll in the dataset
      const electionPolls = data.elections[poll.year].polls;
      const pollToUpdate = electionPolls.find(p => p.url === poll.url);
      
      if (!pollToUpdate) {
        console.log(`  ❓ Poll not found in dataset`);
        continue;
      }
      
      if (verification.scope === 'regional') {
        console.log(`  🚨 REMOVING REGIONAL POLL: ${verification.region || 'unknown region'}`);
        
        const pollIndex = electionPolls.findIndex(p => p.url === poll.url);
        if (pollIndex >= 0) {
          electionPolls.splice(pollIndex, 1);
          removed++;
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
    
    console.log(`\\n=== SUSPICIOUS PATTERN FIX RESULTS ===`);
    console.log(`Polls verified: ${verified}`);
    console.log(`Regional polls removed: ${removed}`);
    
    return { verified, removed };
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
    
    console.log('✅ Updated public and src data files with pattern-cleaned national polls');
    
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
      const results = await this.fixSuspiciousPatterns();
      await this.createCleanNationalDataset();
      
      if (results.removed > 0) {
        console.log(`\\n✅ Suspicious pattern fix complete! Removed ${results.removed} regional/municipal polls.`);
        console.log('The charts now exclude local and municipal polls from national trends.');
      } else {
        console.log('\\n✅ No suspicious patterns found to fix.');
      }
      
    } catch (error) {
      console.error('❌ Error in suspicious pattern fixer:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fixer = new SuspiciousPatternFixer();
  fixer.run();
}

module.exports = SuspiciousPatternFixer;
