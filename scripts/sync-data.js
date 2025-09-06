#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔄 Syncing polling data across all locations...\n');

// Source: data/polling-data.json (raw data with all polls)
const sourceFile = path.join(__dirname, '..', 'data', 'polling-data.json');

// Destinations
const publicFile = path.join(__dirname, '..', 'public', 'data', 'polling-data.json');
const srcFile = path.join(__dirname, '..', 'src', 'data', 'polling-data.json');

if (!fs.existsSync(sourceFile)) {
  console.error('❌ Source file not found:', sourceFile);
  process.exit(1);
}

try {
  // Read source data
  const sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  
  // Create national-only dataset
  const nationalData = { elections: {} };
  
  Object.entries(sourceData.elections).forEach(([year, election]) => {
    const nationalPolls = election.polls.filter(poll => poll.scope === 'national');
    
    if (nationalPolls.length > 0) {
      nationalData.elections[year] = {
        ...election,
        polls: nationalPolls
      };
      
      const total = election.polls.length;
      const removed = total - nationalPolls.length;
      console.log(`${year}: ${nationalPolls.length} national polls (${removed} regional filtered out)`);
    }
  });
  
  // Ensure directories exist
  const publicDir = path.dirname(publicFile);
  const srcDir = path.dirname(srcFile);
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }
  
  // Write to both locations
  fs.writeFileSync(publicFile, JSON.stringify(nationalData, null, 2));
  fs.writeFileSync(srcFile, JSON.stringify(nationalData, null, 2));
  
  // Also sync real donation statistics if they exist
  const realDonationStatsSource = path.join(__dirname, '..', 'data', 'real-api-donation-statistics.json');
  if (fs.existsSync(realDonationStatsSource)) {
    const donationStatsPublic = path.join(__dirname, '..', 'public', 'data', 'donation-statistics.json');
    const donationStatsSrc = path.join(__dirname, '..', 'src', 'data', 'donation-statistics.json');
    
    const donationData = fs.readFileSync(realDonationStatsSource, 'utf8');
    fs.writeFileSync(donationStatsPublic, donationData);
    fs.writeFileSync(donationStatsSrc, donationData);
    
    console.log(`📄 Updated: ${donationStatsPublic}`);
    console.log(`📄 Updated: ${donationStatsSrc}`);
  }
  
  console.log('\n✅ Data sync complete!');
  console.log(`📄 Updated: ${publicFile}`);
  console.log(`📄 Updated: ${srcFile}`);
  console.log('\n🚀 Ready for: npm start, npm run build, or npm run deploy');
  
} catch (error) {
  console.error('❌ Error syncing data:', error.message);
  process.exit(1);
}

