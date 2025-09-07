const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class ImprovedDonationFetcher {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'data', 'improved-donation-data.json');
    this.apiUrl = 'https://partistatistikkclient.statsforvalteren.no/financing/PaginatedCampaignContributions';
    
    // Only include major parties in final statistics
    this.majorParties = [
      'Arbeiderpartiet',
      'Høyre', 
      'Senterpartiet',
      'Fremskrittspartiet',
      'Sosialistisk Venstreparti',
      'Rødt',
      'Venstre',
      'Kristelig Folkeparti',
      'Miljøpartiet De Grønne'
    ];
  }

  async fetchRealDonationData() {
    console.log('🔄 Fetching improved donation data with better validation...');
    
    const allDonations = [];
    let pageNumber = 1;
    let hasMorePages = true;
    
    // Fetch ALL donations in one go
    while (hasMorePages && pageNumber <= 20) {
      try {
        console.log(`📄 Fetching page ${pageNumber}...`);
        
        const formData = new URLSearchParams({
          year: '2025',
          name: '',
          centralPartyListCode: '', // All parties
          partyLevelId: '-1',
          countyId: '-1', 
          municipalityId: '-1',
          pageNumber: pageNumber.toString(),
          pageSize: '100',
          columnSort: '-7'
        });

        const response = await axios.post(this.apiUrl, formData, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) Gecko/20100101 Firefox/142.0',
            'Accept': '*/*',
            'Accept-Language': 'nb-NO,nb;q=0.9,no-NO;q=0.8,no;q=0.6,nn-NO;q=0.5,nn;q=0.4,en-US;q=0.3,en;q=0.1',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://www.partifinansiering.no',
            'Referer': 'https://www.partifinansiering.no/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site'
          },
          timeout: 15000
        });

        if (response.data && response.data.PageEntries) {
          const pageEntries = response.data.PageEntries;
          allDonations.push(...pageEntries);
          
          console.log(`    ✅ ${pageEntries.length} donations`);
          
          const totalResults = response.data.TotalResults || 0;
          const currentResults = pageNumber * 100;
          hasMorePages = currentResults < totalResults && pageEntries.length > 0;
          
          if (hasMorePages) {
            pageNumber++;
            await new Promise(resolve => setTimeout(resolve, 500)); // Be respectful
          }
        } else {
          hasMorePages = false;
        }
        
      } catch (error) {
        console.warn(`⚠️ Error on page ${pageNumber}: ${error.message}`);
        hasMorePages = false;
      }
    }
    
    console.log(`✅ Total donations fetched: ${allDonations.length}`);
    return this.processImprovedData(allDonations);
  }

  processImprovedData(apiDonations) {
    console.log('🔄 Processing data with improved validation...');
    
    const donationData = {
      year: 2025,
      lastUpdated: new Date().toISOString(),
      source: 'partifinansiering.no (improved API with validation)',
      rawDonations: apiDonations.length,
      parties: {},
      duplicatesRemoved: 0,
      nonMajorPartiesFiltered: 0
    };

    // Track duplicates
    const seenDonations = new Set();
    let duplicatesRemoved = 0;
    let nonMajorFiltered = 0;

    apiDonations.forEach(item => {
      const originalPartyName = item.PartyName;
      const standardPartyName = this.standardizePartyName(originalPartyName);
      const donor = item.ContributorName;
      const amount = item.Amount;
      const receivedDate = item.ReceivedDate;
      
      // Skip if not a major party
      if (!this.majorParties.includes(standardPartyName)) {
        nonMajorFiltered++;
        return;
      }

      // Create unique key for duplicate detection
      const duplicateKey = `${donor}-${amount}-${receivedDate}-${standardPartyName}`;
      if (seenDonations.has(duplicateKey)) {
        duplicatesRemoved++;
        console.log(`🔄 Removing duplicate: ${donor} - ${amount} NOK to ${standardPartyName}`);
        return;
      }
      seenDonations.add(duplicateKey);

      if (standardPartyName && donor && amount > 0) {
        if (!donationData.parties[standardPartyName]) {
          donationData.parties[standardPartyName] = {
            name: standardPartyName,
            donations: [],
            totalAmount: 0,
            donorCount: 0
          };
        }

        donationData.parties[standardPartyName].donations.push({
          id: `${standardPartyName.toLowerCase().replace(/\s+/g, '-')}-${donationData.parties[standardPartyName].donations.length + 1}`,
          donor: donor,
          amount: amount,
          receivedDate: receivedDate,
          reportedDate: item.ReportedDate,
          partyLevel: item.PartyLevel,
          originalPartyName: originalPartyName, // Keep original for verification
          contributorAddress: item.ContributorAddress,
          note: item.Note,
          source: 'partifinansiering.no API'
        });
      }
    });

    donationData.duplicatesRemoved = duplicatesRemoved;
    donationData.nonMajorPartiesFiltered = nonMajorFiltered;

    // Calculate totals and sort
    Object.values(donationData.parties).forEach(party => {
      party.donations.sort((a, b) => b.amount - a.amount);
      party.totalAmount = party.donations.reduce((sum, d) => sum + d.amount, 0);
      party.donorCount = party.donations.length;
    });

    console.log(`🧹 Removed ${duplicatesRemoved} duplicates`);
    console.log(`🗂️  Filtered ${nonMajorFiltered} non-major party donations`);

    return donationData;
  }

  standardizePartyName(apiPartyName) {
    const name = apiPartyName.toUpperCase();
    
    const partyPatterns = {
      'Arbeiderpartiet': [
        'ARBEIDERPARTIET', 'ARBEIDERPARTI', 'ARBEIDARPARTI', 'ARBEIDERNES UNGDOMSFYLKING', 
        'AUF', 'BERGENS ARBEIDERPARTI', 'OSLO ARBEIDERPARTI', 'TRØNDELAG ARBEIDERPARTI',
        'AGDER ARBEIDERPARTI', 'VESTLAND ARBEIDARPARTI', 'ROGALAND ARBEIDERPARTI',
        'STAVANGER ARBEIDERPARTI', 'BUSKERUD ARBEIDERPARTI', 'TROMSØ ARBEIDERPARTI',
        'NORDLAND ARBEIDERPARTI', 'MODUM ARBEIDERPARTI', 'ARBEIDERPARTIET SANDNES',
        'VESTFOLD ARBEIDERPARTI', 'ARBEIDERPARTIET ØSTFOLD', 'TELEMARK ARBEIDERPARTI',
        'INNLANDET ARBEIDERPARTI', 'MØRE OG ROMSDAL ARBEIDERPARTI', 'SUNNFJORD ARBEIDARPARTI',
        'FROGN ARBEIDERPARTI', 'INDRE ØSTFOLD ARBEIDERPARTI', 'KRISTIANSUND ARBEIDERPARTI',
        'ØVRE EIKER ARBEIDERPARTI', 'GJESDAL ARBEIDERPARTI'
      ],
      'Høyre': [
        'HØYRE', 'HØGRE', 'UNGE HØYRES LANDSFORBUND', 'AGDER HØYRE', 'VESTLAND HØGRE',
        'OSLO HØYRE', 'ROGALAND HØYRE', 'NORDLAND HØYRE', 'MØRE OG ROMSDAL HØYRE',
        'TRØNDELAG HØYRE', 'STAVANGER HØYRE', 'BERGEN HØYRE', 'ØYGARDEN HØGRE',
        'HØYRE TELEMARK', 'LARVIK HØYRE', 'ØSTFOLD HØYRE', 'SKIEN HØYRE',
        'VESTBY HØYRE', 'HAMAR HØYRE', 'BÆRUM HØYRE', 'NANNESTAD HØYRE',
        'RANA HØYRE', 'HØYRE ØRLAND', 'HØYRE TØNSBERG', 'INDRE ØSTFOLD HØYRE',
        'SOGNDAL HØGRE'
      ],
      'Senterpartiet': [
        'SENTERPARTIET', 'SENTERPARTI', 'SENTERUNGDOMMEN', 'SENTERPARTIET AKERSHUS',
        'VESTLAND SENTERPARTI', 'MØRE OG ROMSDAL SENTERPARTI', 'TRØNDELAG SENTERPARTI',
        'SENTERPARTIET BUSKERUD', 'OSLO SENTERPARTI', 'MÅLSELV SENTERPARTI',
        'GJØVIK SENTERPARTI', 'GRAN SENTERPARTI', 'LILLESTRØM SP', 'ÅS SENTERPARTI',
        'AGDER SENTERPARTI', 'MODUM SENTERPARTI', 'FROLAND SENTERPARTI',
        'NORDLAND SENTERPARTI', 'SENTERPARTIET I LEVANGER', 'NOME SENTERPARTI',
        'VEFSN SENTERPARTI', 'KVINNHERAD SENTERPARTI', 'NESBYEN SENTERPARTI',
        'SENTERPARTIET NARVIK', 'FLÅ SENTERPARTI', 'LILLEHAMMER SENTERPARTI',
        'BJØRNAFJORDEN SENTERPARTI', 'VENNESLA SENTERPARTI', 'MELHUS SENTERPARTI',
        'SENTERPARTIET ALVER', 'HYLLESTAD SENTERPARTI', 'SENTERPARTIET STEINKJER',
        'VÅGAN SENTERPARTI', 'VÅLER SENTERPARTI', 'INNLANDET SENTERPARTI',
        'TRONDHEIM SENTERPARTI', 'NOTODDEN SENTERPARTI', 'VINDAFJORD SENTERPARTI',
        'LYNGDAL SENTERPARTI', 'ROGALAND SENTERPARTI', 'LURØY SENTERPARTI',
        'SALTDAL SENTERPARTI', 'BRØNNØY SENTERPARTI', 'RINGSAKER SENTERPARTI',
        'RENNEBU SENTERPARTI', 'ULLENSAKER SENTERPARTI', 'NAMSOS SENTERPARTI',
        'SURNADAL SENTERPARTI', 'ØRLAND SENTERPART', 'MARKER SENTERPARTI',
        'TYSVÆR SENTERPARTI', 'HOL SENTERPARTI', 'HAMARØY SENTERPARTI',
        'ORKLAND SENTERPARTI', 'STRAND SENTERPARTI', 'TINGVOLL SENTERPARTI',
        'INNLANDET SENTERUNGDOM', 'ENGERDAL SENTERPARTI', 'GRATANGEN SENTERPARTI',
        'HJELMELAND SENTERPARTI'
      ],
      'Fremskrittspartiet': [
        'FREMSKRITTSPARTIET', 'FREMSKRITTSPARTIETS UNGDOM', 'FRP', 'NORDLAND FRP',
        'ROGALAND FREMSKRITTSPARTI', 'GRIMSTAD FRP', 'VESTFOLD FRP',
        'KRISTIANSAND FRP', 'OSLO FRP', 'ØYGARDEN FRP', 'MOSS FRP',
        'AGDER FRP', 'MØRE OG ROMSDAL FRP', 'BJØRNAFJORDEN FRP',
        'GJØVIK FRP', 'BÆRUM FRP'
      ],
      'Sosialistisk Venstreparti': [
        'SOSIALISTISK VENSTREPARTI', 'SOSIALISTISK UNGDOM', 'SV', 'VESTLAND SV',
        'AGDER SOSIALISTISK VENSTREPARTI', 'BERGEN SOSIALISTISK VENSTREPARTI',
        'TROMSØ SV', 'OSLO SOSIALISTISK VENSTREPARTI', 'SOSIALISTISK VENSTREPARTI AKERSHUS',
        'TRONDHEIM SV', 'SOSIALISTISK VENSTREPARTI VESTFOLD', 'TRØNDELAG SOSIALISTISK VENSTREPARTI',
        'BUSKERUD SOSIALISTISK VENSTREPARTI', 'TELEMARK SOSIALISTISKE VENSTREPARTI',
        'KRISTIANSAND SOSIALISTISK VENSTREPARTI', 'ASKØY SV', 'ASKER SV',
        'ØSTFOLD SV', 'NORDLAND SV', 'MØRE OG ROMSDAL SV', 'HAUGESUND SOSIALISTISK VENSTREPARTI',
        'SOSIALISTISK VENSTREPARTI TROMS', 'ROGALAND SOSIALISTISK VENSTREPARTI',
        'RAUMA SV', 'LILLESTRØM SV', 'SANDNES SV', 'TØNSBERG SV',
        'SOSIALISTISK VENSTREPARTI FINNMARK', 'HARSTAD SV', 'OSLO SOSIALISTISK UNGDOM',
        'TIME SV', 'STAVANGER SV'
      ],
      'Rødt': [
        'RØDT', 'RØD UNGDOM', 'RØDT BUSKERUD', 'RØDT LILLEHAMMER',
        'RAUDT VESTLAND', 'RØDT OSLO', 'RØDT AGDER'
      ],
      'Venstre': [
        'VENSTRE', 'NORGES UNGE VENSTRE', 'OSLO VENSTRE', 'VESTLAND VENSTRE',
        'STAVANGER VENSTRE', 'BERGEN VENSTRE', 'AGDER VENSTRE',
        'ROGALAND VENSTRE', 'HAUGESUND VENSTRE', 'KRISTIANSAND VENSTRE',
        'MØRE OG ROMSDAL VENSTRE', 'HORTEN VENSTRE', 'NORDLAND VENSTRE',
        'AURSKOG HØLAND VENSTRE', 'INNLANDET VENSTRE', 'LILLEHAMMER VENSTRE',
        'OSLO UNGE VENSTRE'
      ],
      'Kristelig Folkeparti': [
        'KRISTELIG FOLKEPARTI', 'KRISTELIG FOLKEPARTIS UNGDOM', 'KRF', 'KRISTELEG FOLKEPARTI',
        'AGDER KRF', 'ROGALAND KRISTELIG FOLKEPARTI', 'KRISTIANSAND KRF',
        'STAVANGER KRF', 'VESTLAND KRISTELIG FOLKEPARTI', 'KRISTELIG FOLKEPARTI ØSTFOLD',
        'NORDLAND KRISTELIG FOLKEPARTI', 'HÅ KRF', 'KRISTELIG FOLKEPARTI TELEMARK',
        'INNLANDET KRISTELIG FOLKEPARTI', 'TRØNDELAG KRISTELIG FOLKEPARTI',
        'VENNESLA KRF', 'KRISTELEG FOLKEPARTI I MØRE OG ROMSDAL',
        'KRISTELIG FOLKEPARTI AKERSHUS', 'KRISTELIG FOLKEPARTI VESTFOLD',
        'ØRSTA LAG AV KRISTELEG FOLKEPARTI'
      ],
      'Miljøpartiet De Grønne': [
        'MILJØPARTIET DE GRØNNE', 'GRØNN UNGDOM', 'MDG', 'OSLO MILJØPARTIET DE GRØNNE',
        'MDG VESTLAND', 'MILJØPARTIET DE GRØNNE AGDER', 'MILJØPARTIET DE GRØNNE AKERSHUS',
        'MILJØPARTIET DE GRØNNE MØRE OG ROMSDAL', 'FROGN MILJØPARTIET DE GRØNNE',
        'GRØNN UNGDOM TROMS'
      ]
    };

    for (const [mainParty, patterns] of Object.entries(partyPatterns)) {
      for (const pattern of patterns) {
        if (name.includes(pattern)) {
          return mainParty;
        }
      }
    }

    // Return null for non-major parties (will be filtered out)
    return null;
  }

  // ... rest of the methods (calculateStatistics, etc.) would be similar to the original
}

if (require.main === module) {
  const fetcher = new ImprovedDonationFetcher();
  fetcher.fetchRealDonationData().then(data => {
    console.log('\n📊 IMPROVED DATA SUMMARY:');
    console.log(`Raw donations: ${data.rawDonations}`);
    console.log(`Duplicates removed: ${data.duplicatesRemoved}`);
    console.log(`Non-major parties filtered: ${data.nonMajorPartiesFiltered}`);
    console.log(`Final donations: ${Object.values(data.parties).reduce((sum, p) => sum + p.donorCount, 0)}`);
  });
}

module.exports = ImprovedDonationFetcher;
