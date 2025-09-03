#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create sample historical data for demonstration
const sampleData = {
  "elections": {
    "2017": {
      "electionDate": "2017-09-11",
      "polls": [
        {
          "date": "2015-10-15",
          "mdgPercentage": 2.1,
          "pollster": "Norstat for NRK",
          "daysUntilElection": 696,
          "rssTitle": "Norstat for NRK, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=2850"
        },
        {
          "date": "2016-01-20",
          "mdgPercentage": 2.8,
          "pollster": "Sentio for Nettavisen",
          "daysUntilElection": 599,
          "rssTitle": "Sentio for Nettavisen, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=2920"
        },
        {
          "date": "2016-06-10",
          "mdgPercentage": 3.2,
          "pollster": "Opinion for Adressa",
          "daysUntilElection": 458,
          "rssTitle": "Opinion for Adressa, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=3050"
        },
        {
          "date": "2016-09-15",
          "mdgPercentage": 4.1,
          "pollster": "Kantar TNS for TV2",
          "daysUntilElection": 361,
          "rssTitle": "Kantar TNS for TV2, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=3180"
        },
        {
          "date": "2017-01-12",
          "mdgPercentage": 4.8,
          "pollster": "Respons for VG",
          "daysUntilElection": 242,
          "rssTitle": "Respons for VG, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=3350"
        },
        {
          "date": "2017-04-20",
          "mdgPercentage": 6.2,
          "pollster": "Norstat for NRK",
          "daysUntilElection": 144,
          "rssTitle": "Norstat for NRK, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=3480"
        },
        {
          "date": "2017-07-05",
          "mdgPercentage": 7.8,
          "pollster": "Opinion for Dagbladet",
          "daysUntilElection": 68,
          "rssTitle": "Opinion for Dagbladet, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=3620"
        },
        {
          "date": "2017-08-28",
          "mdgPercentage": 9.1,
          "pollster": "Kantar TNS for TV2",
          "daysUntilElection": 14,
          "rssTitle": "Kantar TNS for TV2, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=3750"
        }
      ]
    },
    "2021": {
      "electionDate": "2021-09-13",
      "polls": [
        {
          "date": "2019-10-20",
          "mdgPercentage": 3.4,
          "pollster": "Norstat for NRK",
          "daysUntilElection": 693,
          "rssTitle": "Norstat for NRK, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=4200"
        },
        {
          "date": "2020-02-15",
          "mdgPercentage": 4.2,
          "pollster": "Sentio for Nettavisen",
          "daysUntilElection": 575,
          "rssTitle": "Sentio for Nettavisen, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=4350"
        },
        {
          "date": "2020-06-10",
          "mdgPercentage": 2.8,
          "pollster": "Opinion for Adressa",
          "daysUntilElection": 460,
          "rssTitle": "Opinion for Adressa, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=4480"
        },
        {
          "date": "2020-09-20",
          "mdgPercentage": 3.1,
          "pollster": "Kantar for TV2",
          "daysUntilElection": 358,
          "rssTitle": "Kantar for TV2, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=4620"
        },
        {
          "date": "2021-01-18",
          "mdgPercentage": 3.9,
          "pollster": "Respons for VG",
          "daysUntilElection": 238,
          "rssTitle": "Respons for VG, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=4780"
        },
        {
          "date": "2021-05-12",
          "mdgPercentage": 4.7,
          "pollster": "Norstat for NRK",
          "daysUntilElection": 124,
          "rssTitle": "Norstat for NRK, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=4920"
        },
        {
          "date": "2021-07-20",
          "mdgPercentage": 3.8,
          "pollster": "Opinion for Dagbladet",
          "daysUntilElection": 55,
          "rssTitle": "Opinion for Dagbladet, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=5080"
        },
        {
          "date": "2021-08-30",
          "mdgPercentage": 3.2,
          "pollster": "Kantar for TV2",
          "daysUntilElection": 14,
          "rssTitle": "Kantar for TV2, hele landet / stortingsvalg",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=5180"
        }
      ]
    },
    "2025": {
      "electionDate": "2025-09-08",
      "polls": [
        {
          "date": "2025-08-27",
          "mdgPercentage": 4.6,
          "pollster": "pollofpolls.no - Norstat for NRK 27. august 2025",
          "daysUntilElection": 12,
          "rssTitle": "Norstat for NRK, hele landet / stortingsvalg. ",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=5534"
        },
        {
          "date": "2025-08-28",
          "mdgPercentage": 5.6,
          "pollster": "pollofpolls.no - Verian for TV2 28. august 2025",
          "daysUntilElection": 11,
          "rssTitle": "Verian for TV2, hele landet / stortingsvalg. ",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=5555"
        },
        {
          "date": "2025-08-30",
          "mdgPercentage": 6.0,
          "pollster": "pollofpolls.no - Verian for TV2 30. august 2025",
          "daysUntilElection": 9,
          "rssTitle": "Verian for TV2, hele landet / stortingsvalg. ",
          "url": "http://www.pollofpolls.no/?cmd=Maling&gallupid=5556"
        }
      ]
    }
  }
};

// Save to data file
const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'polling-data.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(dataFile, JSON.stringify(sampleData, null, 2));
console.log('Sample historical data created successfully!');

// Also copy to public directory
const publicDataDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(publicDataDir)) {
  fs.mkdirSync(publicDataDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDataDir, 'polling-data.json'), JSON.stringify(sampleData, null, 2));
console.log('Sample data copied to public directory!');
console.log(`Created data for elections: ${Object.keys(sampleData.elections).join(', ')}`);

// Log summary
Object.entries(sampleData.elections).forEach(([year, data]) => {
  console.log(`${year}: ${data.polls.length} polls (${data.polls[0]?.mdgPercentage}% - ${data.polls[data.polls.length-1]?.mdgPercentage}%)`);
});
