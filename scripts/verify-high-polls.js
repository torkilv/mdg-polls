#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class HighPollVerifier {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
  }

  async verifyPollScope(pollUrl) {
    try {
      const response = await axios.get(pollUrl);
      const $ = cheerio.load(response.data);
      
      const pageText = $('body').text().toLowerCase();
      const title = $('title').text().toLowerCase();
      
      // Look for the "Område" table row which is the definitive indicator
      let scope = 'unknown';
      let region = null;
      
      // Check for area/scope in table
      $('tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const firstCell = $(cells[0]).text().toLowerCase().trim();
          const secondCell = $(cells[1]).text().toLowerCase().trim();
          
          if (firstCell === 'område' || firstCell === 'area') {
            if (secondCell.includes('hele landet')) {
              scope = 'national';
              region = null;
            } else if (secondCell.includes('oslo')) {
              scope = 'regional';
              region = 'Oslo';
            } else if (secondCell.includes('bergen')) {
              scope = 'regional';
              region = 'Bergen';
            } else if (secondCell.includes('trondheim')) {
              scope = 'regional';
              region = 'Trondheim';
            } else if (secondCell.includes('stavanger')) {
              scope = 'regional';
              region = 'Stavanger';
            } else {
              scope = 'regional';
              region = secondCell.charAt(0).toUpperCase() + secondCell.slice(1);
            }
          }
        }
      });
      
      // If no table found, check for Oslo-specific indicators in links/text
      if (scope === 'unknown') {
        if (pageText.includes('oslo-måling') || pageText.includes('oslo måling') || 
            (pageText.includes('oslo') && !pageText.includes('hele landet'))) {
          scope = 'regional';
          region = 'Oslo';
        } else if (pageText.includes('hele landet')) {
          scope = 'national';
          region = null;
        }
      }
      
      return { scope, region };
      
    } catch (error) {
      console.error(`Error verifying ${pollUrl}: ${error.message}`);
      return { scope: 'unknown', region: null };
    }
  }

  async verifyHighPolls() {
    console.log('🔍 Verifying high MDG polls (>6%) for correct classification...');
    
    const publicData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'polling-data.json'), 'utf8'));
    
    const highPolls = [];
    Object.entries(publicData.elections).forEach(([year, election]) => {
      election.polls.forEach(poll => {
        if (poll.mdgPercentage > 6) {
          highPolls.push({
            ...poll,
            year
          });
        }
      });
    });
    
    console.log(`Found ${highPolls.length} polls above 6% to verify\\n`);
    
    const misclassified = [];
    let verified = 0;
    
    for (const poll of highPolls.slice(0, 10)) { // Check top 10 highest polls
      console.log(`Verifying: ${poll.mdgPercentage}% - ${poll.year} - ${poll.pollster.substring(0, 50)}...`);
      
      const verification = await this.verifyPollScope(poll.url);
      verified++;
      
      if (verification.scope !== poll.scope) {
        misclassified.push({
          ...poll,
          currentScope: poll.scope,
          correctScope: verification.scope,
          correctRegion: verification.region
        });
        
        console.log(`  🚨 MISCLASSIFIED! Currently: ${poll.scope}, Should be: ${verification.scope} ${verification.region || ''}`);
      } else {
        console.log(`  ✅ Correctly classified as ${verification.scope}`);
      }
      
      // Be respectful to server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\\n=== VERIFICATION RESULTS ===`);
    console.log(`Polls verified: ${verified}`);
    console.log(`Misclassified polls found: ${misclassified.length}`);
    
    if (misclassified.length > 0) {
      console.log('\\nMisclassified polls:');
      misclassified.forEach(poll => {
        console.log(`- ${poll.mdgPercentage}% (${poll.year}): ${poll.currentScope} → ${poll.correctScope} ${poll.correctRegion || ''}`);
        console.log(`  ${poll.pollster}`);
        console.log(`  ${poll.url}`);
        console.log();
      });
    }
    
    return misclassified;
  }

  async run() {
    try {
      const misclassified = await this.verifyHighPolls();
      
      if (misclassified.length > 0) {
        console.log('\\n⚠️  High polls verification found misclassified polls!');
        console.log('These high-percentage polls are likely Oslo or other regional polls');
        console.log('that should not be included in national polling trends.');
      } else {
        console.log('\\n✅ All high polls are correctly classified!');
      }
      
    } catch (error) {
      console.error('❌ Error in high poll verifier:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const verifier = new HighPollVerifier();
  verifier.run();
}

module.exports = HighPollVerifier;
