const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class RealApiDonationFetcher {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'data', 'real-api-donation-data.json');
    
    // Real API endpoint discovered from network inspection
    this.apiUrl = 'https://partistatistikkclient.statsforvalteren.no/financing/PaginatedCampaignContributions';
    
    // Party codes mapping (from the request)
    this.partyCodes = {
      'H': 'Høyre',
      'A': 'Arbeiderpartiet', 
      'SP': 'Senterpartiet',
      'FRP': 'Fremskrittspartiet',
      'SV': 'Sosialistisk Venstreparti',
      'R': 'Rødt',
      'V': 'Venstre',
      'KRF': 'Kristelig Folkeparti',
      'MDG': 'Miljøpartiet De Grønne'
    };
  }

  /**
   * Fetch real donation data using the actual API
   */
  async fetchRealDonationData() {
    console.log('🔄 Fetching REAL 2025 donation data from official API...');
    
    const allDonations = [];
    
    // Fetch data for all major parties
    for (const [partyCode, partyName] of Object.entries(this.partyCodes)) {
      try {
        console.log(`📊 Fetching donations for ${partyName} (${partyCode})...`);
        const partyDonations = await this.fetchPartyDonations(partyCode);
        allDonations.push(...partyDonations);
        
        // Be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.warn(`⚠️ Failed to fetch ${partyName}: ${error.message}`);
      }
    }
    
    console.log(`✅ Total donations fetched: ${allDonations.length}`);
    return this.processDonationData(allDonations);
  }

  /**
   * Fetch donations for a specific party using the real API
   */
  async fetchPartyDonations(partyCode) {
    const donations = [];
    let pageNumber = 1;
    let hasMorePages = true;
    
    while (hasMorePages && pageNumber <= 10) { // Safety limit
      try {
        console.log(`  📄 Page ${pageNumber} for ${partyCode}...`);
        
        // Use the exact parameters from the captured request
        const formData = new URLSearchParams({
          year: '2025',
          name: '', // Empty for all donors
          centralPartyListCode: partyCode,
          partyLevelId: '-1', // All levels
          countyId: '-1', // All counties
          municipalityId: '-1', // All municipalities
          pageNumber: pageNumber.toString(),
          pageSize: '100', // Max results per page
          columnSort: '-7' // Sort by amount descending
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
          donations.push(...pageEntries);
          
          console.log(`    ✅ ${pageEntries.length} donations`);
          
          // Check if there are more pages
          const totalResults = response.data.TotalResults || 0;
          const currentResults = pageNumber * 100;
          hasMorePages = currentResults < totalResults && pageEntries.length > 0;
          
          if (hasMorePages) {
            pageNumber++;
          }
        } else {
          hasMorePages = false;
        }
        
      } catch (error) {
        console.warn(`    ⚠️ Error on page ${pageNumber}: ${error.message}`);
        hasMorePages = false;
      }
    }
    
    return donations;
  }

  /**
   * Process the real API data into our format
   */
  processDonationData(apiDonations) {
    console.log('🔄 Processing real API data...');
    
    const donationData = {
      year: 2025,
      lastUpdated: new Date().toISOString(),
      source: 'partifinansiering.no (real API)',
      parties: {}
    };

    apiDonations.forEach(item => {
      // Extract data from API response structure
      const partyName = this.standardizePartyName(item.PartyName);
      const donor = item.ContributorName;
      const amount = item.Amount;
      const receivedDate = item.ReceivedDate;
      const reportedDate = item.ReportedDate;
      const partyLevel = item.PartyLevel;
      const contributorAddress = item.ContributorAddress;
      const note = item.Note;

      if (partyName && donor && amount > 0) {
        if (!donationData.parties[partyName]) {
          donationData.parties[partyName] = {
            name: partyName,
            donations: [],
            totalAmount: 0,
            donorCount: 0
          };
        }

        donationData.parties[partyName].donations.push({
          id: `${partyName.toLowerCase().replace(/\s+/g, '-')}-${donationData.parties[partyName].donations.length + 1}`,
          donor: donor,
          amount: amount,
          receivedDate: receivedDate,
          reportedDate: reportedDate,
          partyLevel: partyLevel,
          contributorAddress: contributorAddress,
          note: note,
          source: 'partifinansiering.no API'
        });
      }
    });

    // Calculate totals and sort donations by amount
    Object.values(donationData.parties).forEach(party => {
      party.donations.sort((a, b) => b.amount - a.amount);
      party.totalAmount = party.donations.reduce((sum, d) => sum + d.amount, 0);
      party.donorCount = party.donations.length;
    });

    return donationData;
  }

  /**
   * Standardize party names from API to our format
   */
  standardizePartyName(apiPartyName) {
    // Handle the various party name formats from the API
    const mapping = {
      'Høyre': 'Høyre',
      'HØYRE': 'Høyre',
      'Arbeiderpartiet': 'Arbeiderpartiet',
      'ARBEIDERPARTIET': 'Arbeiderpartiet',
      'Senterpartiet': 'Senterpartiet',
      'SENTERPARTIET': 'Senterpartiet',
      'Fremskrittspartiet': 'Fremskrittspartiet',
      'FREMSKRITTSPARTIET': 'Fremskrittspartiet',
      'Sosialistisk Venstreparti': 'Sosialistisk Venstreparti',
      'SOSIALISTISK VENSTREPARTI': 'Sosialistisk Venstreparti',
      'Rødt': 'Rødt',
      'RØDT': 'Rødt',
      'Venstre': 'Venstre',
      'VENSTRE': 'Venstre',
      'Kristelig Folkeparti': 'Kristelig Folkeparti',
      'KRISTELIG FOLKEPARTI': 'Kristelig Folkeparti',
      'Miljøpartiet De Grønne': 'Miljøpartiet De Grønne',
      'MILJØPARTIET DE GRØNNE': 'Miljøpartiet De Grønne'
    };

    // Check direct mapping first
    if (mapping[apiPartyName]) {
      return mapping[apiPartyName];
    }

    // Handle regional/local party names that contain the main party name
    for (const [key, value] of Object.entries(mapping)) {
      if (apiPartyName.toUpperCase().includes(key.toUpperCase()) || 
          apiPartyName.toUpperCase().includes(value.toUpperCase())) {
        return value;
      }
    }

    // Return original if no mapping found (for regional parties)
    return apiPartyName;
  }

  /**
   * Calculate comprehensive statistics
   */
  async calculateStatistics(donationData = null) {
    console.log('📊 Calculating real donation statistics...');

    if (!donationData) {
      try {
        const data = await fs.readFile(this.dataPath, 'utf8');
        donationData = JSON.parse(data);
      } catch (error) {
        console.log('No existing data found, fetching new data...');
        donationData = await this.fetchRealDonationData();
      }
    }

    const statistics = {
      year: donationData.year,
      lastUpdated: donationData.lastUpdated,
      source: donationData.source,
      overview: {},
      parties: {}
    };

    let totalDonations = 0;
    let totalAmount = 0;
    let allAmounts = [];

    // Calculate statistics for each main party only
    const mainParties = Object.keys(this.partyCodes).map(code => this.partyCodes[code]);
    
    for (const [partyName, partyData] of Object.entries(donationData.parties)) {
      const standardName = this.standardizePartyName(partyName);
      
      // Only include main parties in statistics
      if (mainParties.includes(standardName)) {
        const amounts = partyData.donations.map(d => d.amount);
        const sortedAmounts = [...amounts].sort((a, b) => a - b);
        
        const stats = {
          name: standardName,
          donorCount: partyData.donorCount,
          totalAmount: partyData.totalAmount,
          meanDonation: partyData.donorCount > 0 ? Math.round(partyData.totalAmount / partyData.donorCount) : 0,
          medianDonation: this.calculateMedian(sortedAmounts),
          top10PercentThreshold: this.calculatePercentile(sortedAmounts, 90),
          top5PercentThreshold: this.calculatePercentile(sortedAmounts, 95),
          smallestDonation: amounts.length > 0 ? Math.min(...amounts) : 0,
          largestDonation: amounts.length > 0 ? Math.max(...amounts) : 0,
          organizationDonations: partyData.donations.filter(d => this.isOrganization(d.donor)).length,
          individualDonations: partyData.donations.filter(d => !this.isOrganization(d.donor)).length
        };

        // Merge with existing party if already exists
        if (statistics.parties[standardName]) {
          statistics.parties[standardName].donorCount += stats.donorCount;
          statistics.parties[standardName].totalAmount += stats.totalAmount;
          // Recalculate averages
          statistics.parties[standardName].meanDonation = Math.round(
            statistics.parties[standardName].totalAmount / statistics.parties[standardName].donorCount
          );
        } else {
          statistics.parties[standardName] = stats;
        }

        totalDonations += partyData.donorCount;
        totalAmount += partyData.totalAmount;
        allAmounts.push(...amounts);
      }
    }

    // Calculate overall statistics
    const sortedAllAmounts = allAmounts.sort((a, b) => a - b);
    statistics.overview = {
      totalParties: Object.keys(statistics.parties).length,
      totalDonations: totalDonations,
      totalAmount: totalAmount,
      averageDonationSize: totalDonations > 0 ? Math.round(totalAmount / totalDonations) : 0,
      medianDonationSize: this.calculateMedian(sortedAllAmounts),
      top10PercentThreshold: this.calculatePercentile(sortedAllAmounts, 90),
      largestDonation: allAmounts.length > 0 ? Math.max(...allAmounts) : 0,
      smallestDonation: allAmounts.length > 0 ? Math.min(...allAmounts) : 0
    };

    return statistics;
  }

  /**
   * Determine if donor is an organization
   */
  isOrganization(donorName) {
    const orgIndicators = ['AS', 'ASA', 'BA', 'SA', 'KS', 'AL', 'ANS', 'DA', 'Holding', 'Group', 'Invest'];
    return orgIndicators.some(indicator => donorName.toUpperCase().includes(indicator));
  }

  calculateMedian(sortedArray) {
    if (sortedArray.length === 0) return 0;
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? Math.round((sortedArray[mid - 1] + sortedArray[mid]) / 2)
      : sortedArray[mid];
  }

  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  generateReport(statistics) {
    console.log('\n=== REAL 2025 NORWEGIAN POLITICAL PARTY DONATIONS ===');
    console.log(`Source: ${statistics.source}`);
    console.log(`Last Updated: ${new Date(statistics.lastUpdated).toLocaleDateString('no-NO')}`);
    
    const parties = Object.values(statistics.parties);
    if (parties.length === 0) {
      console.log('\n⚠️  No donation data found.');
      return;
    }

    console.log('\n--- OVERALL STATISTICS ---');
    console.log(`Total parties: ${statistics.overview.totalParties}`);
    console.log(`Total donations: ${statistics.overview.totalDonations.toLocaleString('no-NO')}`);
    console.log(`Total amount: ${this.formatCurrency(statistics.overview.totalAmount)}`);
    console.log(`Average donation: ${this.formatCurrency(statistics.overview.averageDonationSize)}`);
    console.log(`Median donation: ${this.formatCurrency(statistics.overview.medianDonationSize)}`);
    console.log(`Top 10% threshold: ${this.formatCurrency(statistics.overview.top10PercentThreshold)}`);

    console.log('\n--- PARTY BREAKDOWN ---');
    parties.sort((a, b) => b.totalAmount - a.totalAmount)
      .forEach((party, index) => {
        console.log(`\n${index + 1}. ${party.name}`);
        console.log(`   Donors: ${party.donorCount.toLocaleString('no-NO')}`);
        console.log(`   Total: ${this.formatCurrency(party.totalAmount)}`);
        console.log(`   Mean: ${this.formatCurrency(party.meanDonation)}`);
        console.log(`   Median: ${this.formatCurrency(party.medianDonation)}`);
        console.log(`   Top 10%: ${this.formatCurrency(party.top10PercentThreshold)}`);
        console.log(`   Largest: ${this.formatCurrency(party.largestDonation)}`);
        console.log(`   Organizations: ${party.organizationDonations} | Individuals: ${party.individualDonations}`);
      });
  }

  async saveStatistics(statistics) {
    const statsPath = path.join(__dirname, '..', 'data', 'real-api-donation-statistics.json');
    await fs.writeFile(statsPath, JSON.stringify(statistics, null, 2));
    console.log(`\n📄 Real statistics saved to ${statsPath}`);
  }

  async run() {
    try {
      console.log('🚀 Starting REAL API donation analysis...\n');
      
      // Fetch real donation data
      const donationData = await this.fetchRealDonationData();
      await fs.writeFile(this.dataPath, JSON.stringify(donationData, null, 2));
      
      // Calculate comprehensive statistics
      const statistics = await this.calculateStatistics(donationData);
      
      // Generate and display report
      this.generateReport(statistics);
      
      // Save statistics for web app
      await this.saveStatistics(statistics);
      
      console.log('\n✅ REAL API donation analysis complete!');
      console.log('🌐 Data source: Official Norwegian Party Financing API');
      console.log('📊 Use this data in your React app with real 2025 donations!');
      
    } catch (error) {
      console.error('\n❌ Real API donation analysis failed:', error.message);
      console.log('💡 This could be due to:');
      console.log('- Network connectivity issues');
      console.log('- API rate limiting');
      console.log('- Changes in the API structure');
    }
  }
}

if (require.main === module) {
  const fetcher = new RealApiDonationFetcher();
  fetcher.run();
}

module.exports = RealApiDonationFetcher;
