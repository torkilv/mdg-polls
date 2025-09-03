#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'polling-data.json'), 'utf8'));

console.log('=== FINDING SUSPICIOUS POLLING PATTERNS ===\n');

// 1. Check for clustered polls from same media on same date
console.log('1. CHECKING FOR CLUSTERED POLLS FROM SAME MEDIA\n');

Object.entries(data.elections).forEach(([year, election]) => {
  console.log(`${year} Election:`);
  
  // Group polls by date and media
  const pollsByDateAndMedia = {};
  
  election.polls.forEach(poll => {
    const date = poll.date;
    // Extract media company from pollster
    let media = 'unknown';
    const pollster = poll.pollster.toLowerCase();
    
    if (pollster.includes('aftenposten')) media = 'Aftenposten';
    else if (pollster.includes('vg')) media = 'VG';
    else if (pollster.includes('tv2')) media = 'TV2';
    else if (pollster.includes('nrk')) media = 'NRK';
    else if (pollster.includes('dagbladet')) media = 'Dagbladet';
    else if (pollster.includes('nettavisen')) media = 'Nettavisen';
    else if (pollster.includes('amedia')) media = 'Amedia';
    else if (pollster.includes('bergens tidende')) media = 'Bergens Tidende';
    else if (pollster.includes('adresseavisen')) media = 'Adresseavisen';
    else if (pollster.includes('klassekampen')) media = 'Klassekampen';
    else if (pollster.includes('vårt land')) media = 'Vårt Land';
    else if (pollster.includes('dagsavisen')) media = 'Dagsavisen';
    
    const key = `${date}-${media}`;
    if (!pollsByDateAndMedia[key]) {
      pollsByDateAndMedia[key] = [];
    }
    pollsByDateAndMedia[key].push(poll);
  });
  
  // Find suspicious clusters (3+ polls from same media on same date)
  const suspiciousClusters = Object.entries(pollsByDateAndMedia)
    .filter(([key, polls]) => polls.length >= 3)
    .sort((a, b) => b[1].length - a[1].length);
  
  if (suspiciousClusters.length > 0) {
    console.log(`  🚨 Found ${suspiciousClusters.length} suspicious clusters:`);
    suspiciousClusters.forEach(([key, polls]) => {
      const [date, media] = key.split('-');
      console.log(`    ${date} - ${media}: ${polls.length} polls`);
      polls.forEach(poll => {
        console.log(`      ${poll.mdgPercentage}% - ${poll.pollster.substring(0, 60)}`);
      });
      console.log();
    });
  } else {
    console.log(`  ✅ No suspicious clusters found`);
  }
  console.log();
});

// 2. Check for 2% polls
console.log('\\n2. CHECKING 2% POLLS FOR SUSPICIOUS PATTERNS\\n');

Object.entries(data.elections).forEach(([year, election]) => {
  const twoPercentPolls = election.polls.filter(poll => poll.mdgPercentage === 2);
  
  console.log(`${year} Election: ${twoPercentPolls.length} polls with exactly 2%`);
  
  if (twoPercentPolls.length > 0) {
    // Group by pollster to see patterns
    const pollsterCounts = {};
    twoPercentPolls.forEach(poll => {
      const pollster = poll.pollster.split(' - ')[1] || poll.pollster;
      pollsterCounts[pollster] = (pollsterCounts[pollster] || 0) + 1;
    });
    
    console.log('  Pollster breakdown:');
    Object.entries(pollsterCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([pollster, count]) => {
        console.log(`    ${pollster}: ${count} polls`);
      });
    
    // Show some examples, especially from 2021
    if (year === '2021') {
      console.log('\\n  Examples of 2% polls in 2021:');
      twoPercentPolls.slice(0, 15).forEach(poll => {
        console.log(`    ${poll.date} - ${poll.pollster}`);
        console.log(`      URL: ${poll.url}`);
      });
    }
  }
  console.log();
});

// 3. Check for other exact percentage clusters that might indicate parsing issues
console.log('\\n3. CHECKING FOR OTHER SUSPICIOUS EXACT PERCENTAGES\\n');

[3, 4, 5].forEach(percentage => {
  console.log(`Polls with exactly ${percentage}%:`);
  
  Object.entries(data.elections).forEach(([year, election]) => {
    const exactPercentagePolls = election.polls.filter(poll => poll.mdgPercentage === percentage);
    if (exactPercentagePolls.length > 0) {
      console.log(`  ${year}: ${exactPercentagePolls.length} polls`);
    }
  });
  console.log();
});
