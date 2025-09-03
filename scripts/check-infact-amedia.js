#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'polling-data.json'), 'utf8'));

console.log('=== CHECKING INFACT FOR AMEDIA SEPTEMBER 1, 2021 POLLS ===\n');

const election2021 = data.elections['2021'];

// Look for InFact for Amedia polls on 2021-09-01
const sept1Polls = election2021.polls.filter(poll => 
  poll.date === '2021-09-01' && 
  poll.pollster.toLowerCase().includes('infact') && 
  poll.pollster.toLowerCase().includes('amedia')
);

console.log(`Found ${sept1Polls.length} InFact for Amedia polls on 2021-09-01:\n`);

sept1Polls.forEach((poll, index) => {
  console.log(`${index + 1}. ${poll.mdgPercentage}% - ${poll.pollster}`);
  console.log(`   URL: ${poll.url}`);
  console.log(`   Days until election: ${poll.daysUntilElection}`);
  console.log(`   Scope: ${poll.scope}, Region: ${poll.region || 'none'}`);
  console.log();
});

// Check if there are other dates with multiple InFact for Amedia polls
console.log('\n=== CHECKING OTHER INFACT FOR AMEDIA POLL CLUSTERS ===');
const infactAmediaPolls = election2021.polls.filter(poll => 
  poll.pollster.toLowerCase().includes('infact') && 
  poll.pollster.toLowerCase().includes('amedia')
);

console.log(`Total InFact for Amedia polls in 2021: ${infactAmediaPolls.length}`);

// Group by date
const pollsByDate = {};
infactAmediaPolls.forEach(poll => {
  const date = poll.date;
  if (!pollsByDate[date]) {
    pollsByDate[date] = [];
  }
  pollsByDate[date].push(poll);
});

// Find dates with multiple polls
const suspiciousDates = Object.entries(pollsByDate).filter(([date, polls]) => polls.length > 1);

if (suspiciousDates.length > 0) {
  console.log('\nDates with multiple InFact for Amedia polls:');
  suspiciousDates.forEach(([date, polls]) => {
    console.log(`  ${date}: ${polls.length} polls`);
    polls.forEach(poll => {
      console.log(`    ${poll.mdgPercentage}% - ${poll.pollster}`);
    });
    console.log();
  });
} else {
  console.log('\nNo suspicious date clusters found for InFact for Amedia.');
}

// Also check the original data to see if we missed any
console.log('\n=== CHECKING ORIGINAL DATA ===');
const originalData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'polling-data.json'), 'utf8'));
const originalElection2021 = originalData.elections['2021'];

const originalSept1Polls = originalElection2021.polls.filter(poll => 
  poll.date === '2021-09-01' && 
  poll.pollster.toLowerCase().includes('infact') && 
  poll.pollster.toLowerCase().includes('amedia')
);

console.log(`Original data had ${originalSept1Polls.length} InFact for Amedia polls on 2021-09-01`);

if (originalSept1Polls.length > sept1Polls.length) {
  console.log(`\n${originalSept1Polls.length - sept1Polls.length} polls were removed during cleanup. Here they are:`);
  originalSept1Polls.forEach(poll => {
    const stillExists = sept1Polls.find(p => p.url === poll.url);
    if (!stillExists) {
      console.log(`  REMOVED: ${poll.mdgPercentage}% - ${poll.pollster}`);
      console.log(`    URL: ${poll.url}`);
      console.log(`    Scope: ${poll.scope}, Region: ${poll.region || 'none'}`);
    }
  });
}
