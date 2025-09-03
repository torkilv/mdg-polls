#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class PollClassificationFixer {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
    
    // Norwegian regions/counties for identification
    this.regions = [
      'oslo', 'akershus', 'østfold', 'vestfold', 'telemark', 'buskerud',
      'oppland', 'hedmark', 'vest-agder', 'aust-agder', 'agder', 'rogaland',
      'hordaland', 'bergen', 'sogn og fjordane', 'møre og romsdal',
      'sør-trøndelag', 'trøndelag', 'trondheim', 'nord-trøndelag', 'nordland',
      'troms', 'finnmark', 'stavanger', 'kristiansand', 'tromsø',
      'drammen', 'fredrikstad', 'sarpsborg', 'skien', 'ålesund', 'bodø',
      'molde', 'haugesund', 'sandnes', 'tønsberg', 'moss', 'arendal'
    ];
  }

  async analyzePollScope(pollUrl) {
    try {
      const response = await axios.get(pollUrl);
      const $ = cheerio.load(response.data);
      
      // Look for the RSS-style title pattern in the page
      const pageText = $('body').text();
      const title = $('title').text().toLowerCase();
      
      // Method 1: Look for "hele landet" in the page content (this indicates national)
      if (pageText.includes(', hele landet /') || title.includes('hele landet')) {
        return { scope: 'national', region: null };
      }
      
      // Method 2: Look for specific region names in the title pattern
      for (const region of this.regions) {
        const regionPattern = new RegExp(`, ${region} /`, 'i');
        if (regionPattern.test(pageText) || title.includes(region.toLowerCase())) {
          return { 
            scope: 'regional', 
            region: region.charAt(0).toUpperCase() + region.slice(1) 
          };
        }
      }
      
      // Method 3: Check the page structure more carefully
      // Look for table headers or other indicators
      const tableHeaders = $('th').text().toLowerCase();
      if (tableHeaders.includes('hele landet')) {
        return { scope: 'national', region: null };
      }
      
      // If we can't determine, mark as unknown
      return { scope: 'unknown', region: null };
      
    } catch (error) {
      console.error(`Error analyzing ${pollUrl}: ${error.message}`);
      return { scope: 'unknown', region: null };
    }
  }

  async fixExistingClassification() {
    console.log('🔧 Fixing existing poll classifications...');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    let totalPolls = 0;
    let fixedPolls = 0;
    let nationalPolls = 0;
    let regionalPolls = 0;
    let unknownPolls = 0;
    
    // Count total polls that need fixing (those marked as 'national' incorrectly)
    Object.values(data.elections).forEach(election => {
      election.polls.forEach(poll => {
        if (poll.scope === 'national') {
          totalPolls++;
        }
      });
    });
    
    console.log(`Total polls to re-analyze: ${totalPolls}`);
    
    for (const [year, election] of Object.entries(data.elections)) {
      console.log(`\n=== Re-analyzing ${year} Election ===`);
      
      for (let i = 0; i < election.polls.length; i++) {
        const poll = election.polls[i];
        
        // Only re-analyze polls that were marked as 'national'
        if (poll.scope !== 'national') {
          continue;
        }
        
        const correctScope = await this.analyzePollScope(poll.url);
        
        // Update the poll with correct scope information
        poll.scope = correctScope.scope;
        if (correctScope.region) {
          poll.region = correctScope.region;
        } else {
          delete poll.region; // Remove region if not regional
        }
        
        fixedPolls++;
        
        if (correctScope.scope === 'national') nationalPolls++;
        else if (correctScope.scope === 'regional') regionalPolls++;
        else unknownPolls++;
        
        console.log(`  ${fixedPolls}/${totalPolls}: ${correctScope.scope.toUpperCase()} ${correctScope.region || ''} - ${poll.pollster.substring(0, 50)}...`);
        
        // Save progress every 25 polls
        if (fixedPolls % 25 === 0) {
          this.saveData(data);
          console.log(`  💾 Progress saved (${fixedPolls}/${totalPolls})`);
        }
        
        // Be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Final save
    this.saveData(data);
    
    console.log('\n=== CLASSIFICATION FIXED ===');
    console.log(`Total polls re-analyzed: ${fixedPolls}`);
    console.log(`National polls: ${nationalPolls}`);
    console.log(`Regional polls: ${regionalPolls}`);
    console.log(`Unknown scope: ${unknownPolls}`);
    
    return data;
  }

  async createNationalOnlyDataset() {
    console.log('\\n=== Creating National-Only Dataset ===');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    const nationalData = { elections: {} };
    
    Object.entries(data.elections).forEach(([year, election]) => {
      const nationalPolls = election.polls.filter(poll => poll.scope === 'national');
      
      if (nationalPolls.length > 0) {
        nationalData.elections[year] = {
          ...election,
          polls: nationalPolls
        };
        
        console.log(`${year}: ${nationalPolls.length} national polls (from ${election.polls.length} total)`);
      }
    });
    
    // Update public directory with national-only data
    const publicDataDir = path.join(__dirname, '..', 'public', 'data');
    if (!fs.existsSync(publicDataDir)) {
      fs.mkdirSync(publicDataDir, { recursive: true });
    }
    fs.writeFileSync(path.join(publicDataDir, 'polling-data.json'), JSON.stringify(nationalData, null, 2));
    
    // Update src fallback data
    fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'polling-data.json'), JSON.stringify(nationalData, null, 2));
    
    console.log('✅ Created national-only dataset');
    console.log('✅ Updated public and src data files with national polls only');
    
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
      console.log('🔍 Fixing poll classification with correct logic...');
      
      await this.fixExistingClassification();
      await this.createNationalOnlyDataset();
      
      console.log('\n✅ Poll classification fix completed successfully!');
      
    } catch (error) {
      console.error('❌ Error in poll classification fixer:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fixer = new PollClassificationFixer();
  fixer.run();
}

module.exports = PollClassificationFixer;
