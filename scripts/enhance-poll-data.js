#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class PollDataEnhancer {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
    
    // Norwegian regions/counties for identification
    this.regions = [
      'oslo', 'akershus', 'østfold', 'vestfold', 'telemark', 'buskerud',
      'oppland', 'hedmark', 'vest-agder', 'aust-agder', 'rogaland',
      'hordaland', 'bergen', 'sogn og fjordane', 'møre og romsdal',
      'sør-trøndelag', 'trondheim', 'nord-trøndelag', 'nordland',
      'troms', 'finnmark', 'stavanger', 'kristiansand', 'tromsø',
      'drammen', 'fredrikstad', 'sarpsborg', 'skien', 'ålesund'
    ];
  }

  async analyzePollScope(pollUrl) {
    try {
      console.log(`Analyzing: ${pollUrl}`);
      const response = await axios.get(pollUrl);
      const $ = cheerio.load(response.data);
      
      const title = $('title').text().toLowerCase();
      const pageText = $('body').text().toLowerCase();
      
      // Check for "hele landet" (national) indicator
      if (pageText.includes('hele landet') || title.includes('hele landet')) {
        return { scope: 'national', region: null };
      }
      
      // Check for specific regions
      for (const region of this.regions) {
        if (pageText.includes(region) || title.includes(region)) {
          return { 
            scope: 'regional', 
            region: region.charAt(0).toUpperCase() + region.slice(1) 
          };
        }
      }
      
      // If no clear indicators, mark as unknown
      return { scope: 'unknown', region: null };
      
    } catch (error) {
      console.error(`Error analyzing ${pollUrl}:`, error.message);
      return { scope: 'unknown', region: null };
    }
  }

  async enhanceExistingData() {
    console.log('Loading existing polling data...');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    let totalPolls = 0;
    let processedPolls = 0;
    let nationalPolls = 0;
    let regionalPolls = 0;
    let unknownPolls = 0;
    
    // Count total polls
    Object.values(data.elections).forEach(election => {
      totalPolls += election.polls.length;
    });
    
    console.log(`Total polls to analyze: ${totalPolls}`);
    
    for (const [year, election] of Object.entries(data.elections)) {
      console.log(`\n=== Processing ${year} Election ===`);
      
      for (let i = 0; i < election.polls.length; i++) {
        const poll = election.polls[i];
        
        // Skip if already has scope information
        if (poll.scope) {
          processedPolls++;
          continue;
        }
        
        const scopeInfo = await this.analyzePollScope(poll.url);
        
        // Update the poll with scope information
        poll.scope = scopeInfo.scope;
        if (scopeInfo.region) {
          poll.region = scopeInfo.region;
        }
        
        processedPolls++;
        
        if (scopeInfo.scope === 'national') nationalPolls++;
        else if (scopeInfo.scope === 'regional') regionalPolls++;
        else unknownPolls++;
        
        console.log(`  ${processedPolls}/${totalPolls}: ${scopeInfo.scope.toUpperCase()} - ${poll.pollster.substring(0, 50)}...`);
        
        // Save progress every 50 polls
        if (processedPolls % 50 === 0) {
          this.saveData(data);
          console.log(`  💾 Progress saved (${processedPolls}/${totalPolls})`);
        }
        
        // Be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    
    // Final save
    this.saveData(data);
    
    console.log('\n=== ENHANCEMENT COMPLETE ===');
    console.log(`Total polls processed: ${processedPolls}`);
    console.log(`National polls: ${nationalPolls}`);
    console.log(`Regional polls: ${regionalPolls}`);
    console.log(`Unknown scope: ${unknownPolls}`);
    
    return data;
  }

  async createFilteredDatasets() {
    console.log('\n=== Creating Filtered Datasets ===');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    
    // Create national-only dataset
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
    
    // Save national-only dataset
    const nationalFile = path.join(this.dataDir, 'polling-data-national.json');
    fs.writeFileSync(nationalFile, JSON.stringify(nationalData, null, 2));
    
    // Also update public directory with national-only data
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
      console.log('🔍 Enhancing polling data with scope information...');
      
      await this.enhanceExistingData();
      await this.createFilteredDatasets();
      
      console.log('\n✅ Poll data enhancement completed successfully!');
      
    } catch (error) {
      console.error('❌ Error in poll data enhancer:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const enhancer = new PollDataEnhancer();
  enhancer.run();
}

module.exports = PollDataEnhancer;
