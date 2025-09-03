#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class SmartPollClassifier {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dataFile = path.join(this.dataDir, 'polling-data.json');
    
    // National media outlets that typically do national polls
    this.nationalOutlets = [
      'tv2', 'nrk', 'vg', 'dagbladet', 'aftenposten', 'dagens næringsliv',
      'nettavisen', 'vårt land', 'nationen', 'klassekampen', 'abc nyheter',
      'avisenes nyhetsbyrå', 'dagsavisen', 'frifagbevegelse'
    ];
    
    // Regional/local media outlets
    this.regionalOutlets = [
      'telemarksavisa', 'bt', 'bergens tidende', 'adressa', 'adresseavisen',
      'stavanger aftenblad', 'nordlys', 'sunnmørsposten', 'fædrelandsvennen',
      'gudbrandsdølen dagningen', 'firda', 'hamar arbeiderblad', 'oppland arbeiderblad',
      'østlendingen', 'romerikes blad', 'moss avis', 'fredriksstad blad',
      'sarpsborg arbeiderblad', 'drammens tidende', 'laagendalsposten',
      'tønsbergs blad', 'sandefjords blad', 'vestfold og telemark',
      'agderposten', 'lindesnes avis', 'sørlandet', 'rogalands avis',
      'haugesunds avis', 'sunnhordland', 'hordaland', 'sogn avis',
      'fjordenes tidende', 'møre-nytt', 'romsdals budstikke', 'tidens krav',
      'trønder-avisa', 'namdalsavisa', 'nordlands framtid', 'lofotposten',
      'avisa nordland', 'nordlys', 'finnmarken', 'altaposten', 'finnmark dagblad'
    ];
    
    // Regional identifiers in poll titles
    this.regionNames = [
      'oslo', 'akershus', 'østfold', 'vestfold', 'telemark', 'buskerud',
      'oppland', 'hedmark', 'vest-agder', 'aust-agder', 'agder', 'rogaland',
      'hordaland', 'bergen', 'sogn og fjordane', 'møre og romsdal',
      'sør-trøndelag', 'trøndelag', 'trondheim', 'nord-trøndelag', 'nordland',
      'troms', 'finnmark', 'stavanger', 'kristiansand', 'tromsø',
      'drammen', 'fredrikstad', 'sarpsborg', 'skien', 'ålesund', 'bodø',
      'molde', 'haugesund', 'sandnes', 'tønsberg', 'moss', 'arendal'
    ];
  }

  classifyPoll(poll) {
    const pollsterLower = poll.pollster.toLowerCase();
    
    // Method 1: Check for explicit regional indicators in pollster name
    for (const region of this.regionNames) {
      if (pollsterLower.includes(region)) {
        return {
          scope: 'regional',
          region: region.charAt(0).toUpperCase() + region.slice(1),
          reason: `Region name "${region}" found in pollster`
        };
      }
    }
    
    // Method 2: Check for regional media outlets
    for (const outlet of this.regionalOutlets) {
      if (pollsterLower.includes(outlet)) {
        return {
          scope: 'regional',
          region: this.guessRegionFromOutlet(outlet),
          reason: `Regional outlet "${outlet}" identified`
        };
      }
    }
    
    // Method 3: Check for national media outlets
    for (const outlet of this.nationalOutlets) {
      if (pollsterLower.includes(outlet)) {
        return {
          scope: 'national',
          region: null,
          reason: `National outlet "${outlet}" identified`
        };
      }
    }
    
    // Method 4: Check pollster company patterns
    if (pollsterLower.includes('norstat') || 
        pollsterLower.includes('verian') || 
        pollsterLower.includes('kantar') ||
        pollsterLower.includes('opinion') ||
        pollsterLower.includes('sentio') ||
        pollsterLower.includes('respons') ||
        pollsterLower.includes('ipsos') ||
        pollsterLower.includes('infact') ||
        pollsterLower.includes('norfakta')) {
      
      // These are polling companies - need to check the media outlet they polled for
      // If no specific regional outlet is mentioned, likely national
      return {
        scope: 'national',
        region: null,
        reason: 'Polling company without specific regional outlet'
      };
    }
    
    // Default to unknown if we can't determine
    return {
      scope: 'unknown',
      region: null,
      reason: 'Could not determine scope from pollster name'
    };
  }
  
  guessRegionFromOutlet(outlet) {
    const regionMap = {
      'telemarksavisa': 'Telemark',
      'bt': 'Hordaland',
      'bergens tidende': 'Hordaland',
      'adressa': 'Trøndelag',
      'adresseavisen': 'Trøndelag',
      'stavanger aftenblad': 'Rogaland',
      'nordlys': 'Troms',
      'sunnmørsposten': 'Møre og Romsdal',
      'fædrelandsvennen': 'Agder',
      'gudbrandsdølen dagningen': 'Oppland',
      'firda': 'Sogn og Fjordane'
    };
    
    return regionMap[outlet] || 'Unknown region';
  }

  async classifyAllPolls() {
    console.log('🎯 Classifying polls using smart pattern recognition...');
    
    const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    let totalPolls = 0;
    let nationalPolls = 0;
    let regionalPolls = 0;
    let unknownPolls = 0;
    
    const classifications = {
      national: [],
      regional: [],
      unknown: []
    };
    
    for (const [year, election] of Object.entries(data.elections)) {
      console.log(`\n=== Classifying ${year} Election ===`);
      
      for (const poll of election.polls) {
        const classification = this.classifyPoll(poll);
        
        // Update poll with classification
        poll.scope = classification.scope;
        if (classification.region) {
          poll.region = classification.region;
        }
        
        totalPolls++;
        
        if (classification.scope === 'national') {
          nationalPolls++;
          classifications.national.push({
            pollster: poll.pollster,
            reason: classification.reason
          });
        } else if (classification.scope === 'regional') {
          regionalPolls++;
          classifications.regional.push({
            pollster: poll.pollster,
            region: classification.region,
            reason: classification.reason
          });
        } else {
          unknownPolls++;
          classifications.unknown.push({
            pollster: poll.pollster,
            reason: classifild yocation.reason
          });
        }
      }
      
      const yearNational = election.polls.filter(p => p.scope === 'national').length;
      const yearRegional = election.polls.filter(p => p.scope === 'regional').length;
      const yearUnknown = election.polls.filter(p => p.scope === 'unknown').length;
      
      console.log(`  ${yearNational} national, ${yearRegional} regional, ${yearUnknown} unknown`);
    }
    
    // Save the updated data
    this.saveData(data);
    
    console.log('\n=== CLASSIFICATION COMPLETE ===');
    console.log(`Total polls: ${totalPolls}`);
    console.log(`National: ${nationalPolls} (${Math.round(nationalPolls/totalPolls*100)}%)`);
    console.log(`Regional: ${regionalPolls} (${Math.round(regionalPolls/totalPolls*100)}%)`);
    console.log(`Unknown: ${unknownPolls} (${Math.round(unknownPolls/totalPolls*100)}%)`);
    
    // Show some examples
    if (classifications.regional.length > 0) {
      console.log('\nSample regional polls:');
      classifications.regional.slice(0, 5).forEach(p => {
        console.log(`  - ${p.pollster.substring(0, 60)}... (${p.region})`);
      });
    }
    
    if (classifications.unknown.length > 0) {
      console.log('\nSample unknown polls:');
      classifications.unknown.slice(0, 5).forEach(p => {
        console.log(`  - ${p.pollster.substring(0, 60)}...`);
      });
    }
    
    return data;
  }

  async createNationalOnlyDataset() {
    console.log('\n=== Creating National-Only Dataset ===');
    
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
    
    console.log('✅ Created and deployed national-only dataset');
    
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
      await this.classifyAllPolls();
      await this.createNationalOnlyDataset();
      
      console.log('\n✅ Smart poll classification completed successfully!');
      
    } catch (error) {
      console.error('❌ Error in smart poll classifier:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const classifier = new SmartPollClassifier();
  classifier.run();
}

module.exports = SmartPollClassifier;
