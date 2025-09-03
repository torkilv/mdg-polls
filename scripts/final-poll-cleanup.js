#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class FinalPollCleanup {
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
        } else if (pageText.includes('hele landet')) {
          scope = 'national';
          region = null;
        }
      }
      
      // Method 3: Check for district-specific patterns in titles/links
      if (scope === 'unknown') {
        const regions = ['oslo', 'bergen', 'trondheim', 'stavanger', 'akershus', 'rogaland', 
                        'hordaland', 'vestland', 'telemark', 'vestfold', 'østfold', 'hedmark', 
                        'oppland', 'innlandet', 'buskerud', 'viken', 'møre og romsdal', 
                        'sør-trøndelag', 'trøndelag', 'nord-trøndelag', 'nordland', 'troms', 'finnmark'];
        
        for (const regionName of regions) {
          if (pageText.includes(regionName) && !pageText.includes('hele landet')) {
            // Check if it's actually about that region specifically
            const regionCount = (pageText.match(new RegExp(regionName, 'g')) || []).length;
            if (regionCount > 1) { // Multiple mentions suggest regional focus
              scope = 'regional';
              region = regionName.charAt(0).toUpperCase() + regionName.slice(1);
              break;
            }
          }
        }
      }
      
      return { scope, region };
      
    } catch (error) {
      console.error(`Error verifying ${pollUrl}: ${error.message}`);
      return { scope: 'unknown', region: null };
    }
  }

  async cleanupRegionalPolls() {
    console.log('🔍 Final cleanup of regional polls...');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    
    // Focus on high-percentage polls and known problematic patterns
    const suspiciousPolls = [];
    
    Object.entries(data.elections).forEach(([year, election]) => {
      election.polls.forEach((poll, index) => {
        // Check for high percentages (likely Oslo)
        if (poll.mdgPercentage > 6) {
          suspiciousPolls.push({ ...poll, year, index });
        }
        
        // Check for NRK district patterns
        const pollster = poll.pollster.toLowerCase();
        if (pollster.includes('nrk') && 
            (pollster.includes('akershus') || pollster.includes('oslo') || 
             pollster.includes('rogaland') || pollster.includes('hordaland') ||
             pollster.includes('telemark') || pollster.includes('vestfold') ||
             pollster.includes('østfold') || pollster.includes('hedmark') ||
             pollster.includes('oppland') || pollster.includes('buskerud'))) {
          suspiciousPolls.push({ ...poll, year, index });
        }
        
        // Check for VG 2021 district polls
        if (year === '2021' && pollster.includes('vg') && poll.date >= '2021-08-01') {
          suspiciousPolls.push({ ...poll, year, index });
        }
      });
    });
    
    console.log(`Found ${suspiciousPolls.length} suspicious polls to verify...\\n`);
    
    let verified = 0;
    let reclassified = 0;
    
    // Check each suspicious poll (limit to avoid overwhelming server)
    for (const poll of suspiciousPolls.slice(0, 20)) {
      console.log(`Verifying: ${poll.mdgPercentage}% - ${poll.year} - ${poll.pollster.substring(0, 50)}...`);
      
      const verification = await this.verifyPollScope(poll.url);
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save updated data
    this.saveData(data);
    
    console.log(`\\n=== CLEANUP RESULTS ===`);
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
    
    console.log('✅ Updated public and src data files with final clean national polls');
    
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
      const results = await this.cleanupRegionalPolls();
      await this.createCleanNationalDataset();
      
      if (results.reclassified > 0) {
        console.log(`\\n✅ Final cleanup complete! Reclassified ${results.reclassified} regional polls.`);
        console.log('The 100-day chart will now show only genuine national polls.');
      } else {
        console.log('\\n✅ No additional regional polls found!');
      }
      
    } catch (error) {
      console.error('❌ Error in final cleanup:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const cleanup = new FinalPollCleanup();
  cleanup.run();
}

module.exports = FinalPollCleanup;
