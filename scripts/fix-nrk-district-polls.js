#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class NRKDistrictPollFixer {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
  }

  async verifyNRKPoll(pollUrl) {
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
              // Extract region name
              if (secondCell.includes('oslo')) region = 'Oslo';
              else if (secondCell.includes('akershus')) region = 'Akershus';
              else if (secondCell.includes('rogaland')) region = 'Rogaland';
              else if (secondCell.includes('hordaland')) region = 'Hordaland';
              else if (secondCell.includes('vestland')) region = 'Vestland';
              else if (secondCell.includes('telemark')) region = 'Telemark';
              else if (secondCell.includes('vestfold')) region = 'Vestfold';
              else if (secondCell.includes('østfold')) region = 'Østfold';
              else if (secondCell.includes('hedmark')) region = 'Hedmark';
              else if (secondCell.includes('oppland')) region = 'Oppland';
              else if (secondCell.includes('innlandet')) region = 'Innlandet';
              else if (secondCell.includes('buskerud')) region = 'Buskerud';
              else if (secondCell.includes('viken')) region = 'Viken';
              else if (secondCell.includes('trøndelag')) region = 'Trøndelag';
              else if (secondCell.includes('nordland')) region = 'Nordland';
              else if (secondCell.includes('troms')) region = 'Troms';
              else if (secondCell.includes('finnmark')) region = 'Finnmark';
              else region = secondCell.charAt(0).toUpperCase() + secondCell.slice(1);
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

  async fixNRKDistrictPolls() {
    console.log('🔍 Fixing NRK district polls...');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    
    // Find suspicious NRK poll clusters (multiple polls from same date)
    const suspiciousNRKPolls = [];
    
    Object.entries(data.elections).forEach(([year, election]) => {
      // Group NRK polls by date
      const nrkPollsByDate = {};
      
      election.polls.forEach((poll, index) => {
        if (poll.pollster.toLowerCase().includes('norstat for nrk') && 
            poll.scope === 'national') {
          
          const date = poll.date;
          if (!nrkPollsByDate[date]) {
            nrkPollsByDate[date] = [];
          }
          nrkPollsByDate[date].push({ ...poll, year, index });
        }
      });
      
      // Find dates with multiple NRK polls (likely district polling)
      Object.entries(nrkPollsByDate).forEach(([date, polls]) => {
        if (polls.length > 3) { // More than 3 polls on same date = likely district polling
          console.log(`Found ${polls.length} NRK polls on ${date} in ${year} - likely district polling`);
          suspiciousNRKPolls.push(...polls);
        }
      });
    });
    
    console.log(`\\nFound ${suspiciousNRKPolls.length} suspicious NRK polls to verify...\\n`);
    
    let verified = 0;
    let reclassified = 0;
    
    // Check each suspicious poll
    for (const poll of suspiciousNRKPolls) { // Process all suspicious polls
      console.log(`Verifying: ${poll.mdgPercentage}% - ${poll.year} - ${poll.date} - gallupid=${poll.url.split('gallupid=')[1]}`);
      
      const verification = await this.verifyNRKPoll(poll.url);
      verified++;
      
      if (verification.scope === 'regional' && poll.scope === 'national') {
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
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Save updated data
    this.saveData(data);
    
    console.log(`\\n=== NRK DISTRICT POLL FIX RESULTS ===`);
    console.log(`Polls verified: ${verified}`);
    console.log(`Polls reclassified: ${reclassified}`);
    
    return { verified, reclassified };
  }

  async createCleanNationalDataset() {
    console.log('\\n=== Creating Final Clean National Dataset ===');
    
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
    
    console.log('✅ Updated public and src data files with NRK-cleaned national polls');
    
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
      const results = await this.fixNRKDistrictPolls();
      await this.createCleanNationalDataset();
      
      if (results.reclassified > 0) {
        console.log(`\\n✅ NRK district poll fix complete! Reclassified ${results.reclassified} regional polls.`);
        console.log('The charts will now exclude NRK district polls from national trends.');
      } else {
        console.log('\\n✅ No NRK district polls found to reclassify.');
      }
      
    } catch (error) {
      console.error('❌ Error in NRK district poll fixer:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fixer = new NRKDistrictPollFixer();
  fixer.run();
}

module.exports = NRKDistrictPollFixer;
