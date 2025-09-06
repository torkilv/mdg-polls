const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

class RealDonationFetcher {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'data', 'real-donation-data.json');
    this.baseUrl = 'https://www.partifinansiering.no';
    this.apiUrl = 'https://www.partifinansiering.no/nb/bidrag-i-valgar/';
    this.currentYear = new Date().getFullYear();
    this.electionYears = [2025, 2021, 2017, 2013]; // Recent election years
    this.testYear = 2021; // Start with a year we know has data
    
    // Map Norwegian party names to our standardized names
    this.partyNameMap = {
      'Arbeiderpartiet': 'Arbeiderpartiet',
      'Høyre': 'Høyre',
      'Senterpartiet': 'Senterpartiet', 
      'Fremskrittspartiet': 'Fremskrittspartiet',
      'Sosialistisk Venstreparti': 'Sosialistisk Venstreparti',
      'Rødt': 'Rødt',
      'Venstre': 'Venstre',
      'Kristelig Folkeparti': 'Kristelig Folkeparti',
      'Miljøpartiet De Grønne': 'Miljøpartiet De Grønne'
    };
  }

  /**
   * Fetch real donation data from partifinansiering.no with dropdown and pagination handling
   */
  async fetchRealDonationData() {
    console.log('🔄 Fetching real donation data from partifinansiering.no...');
    
    try {
      // First, get the main page to understand the structure
      const response = await axios.get(this.apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'no,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      const $ = cheerio.load(response.data);
      console.log('📄 Analyzing page structure for AJAX endpoints...');
      
      // Look for the data table endpoint or form submission URL
      const scripts = $('script');
      let dataEndpoint = null;
      let csrfToken = null;
      
      // Extract CSRF token if present
      const csrfInput = $('input[name="_token"]');
      if (csrfInput.length > 0) {
        csrfToken = csrfInput.attr('value');
        console.log('🔐 Found CSRF token');
      }
      
      // Look for AJAX endpoints in JavaScript
      scripts.each((i, script) => {
        const scriptContent = $(script).html();
        if (scriptContent) {
          // Look for DataTable or AJAX configuration
          const datatableMatch = scriptContent.match(/ajax\s*:\s*['"]([^'"]+)['"]/);
          if (datatableMatch) {
            dataEndpoint = datatableMatch[1];
            console.log(`🔗 Found DataTable AJAX endpoint: ${dataEndpoint}`);
          }
          
          // Alternative patterns for AJAX endpoints
          const ajaxMatch = scriptContent.match(/url\s*:\s*['"]([^'"]*bidrag[^'"]*)['"]/i);
          if (ajaxMatch && !dataEndpoint) {
            dataEndpoint = ajaxMatch[1];
            console.log(`🔗 Found AJAX endpoint: ${dataEndpoint}`);
          }
        }
      });

      if (dataEndpoint) {
        return await this.fetchPaginatedData(dataEndpoint, csrfToken);
      }

      // Fallback: try to find form submission endpoint
      const forms = $('form');
      if (forms.length > 0) {
        const formAction = $(forms[0]).attr('action') || this.apiUrl;
        console.log(`📋 Found form, attempting to submit with filters...`);
        return await this.fetchViaFormSubmission(formAction, csrfToken);
      }

      // Last resort: parse any visible data
      return await this.parseVisibleData($);
      
    } catch (error) {
      console.error('❌ Error fetching real donation data:', error.message);
      throw error;
    }
  }

  /**
   * Fetch paginated data from the AJAX endpoint
   */
  async fetchPaginatedData(endpoint, csrfToken) {
    console.log('📊 Fetching paginated donation data...');
    
    const allDonations = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    while (hasMorePages && currentPage <= 50) { // Safety limit
      console.log(`📄 Fetching page ${currentPage}...`);
      
      try {
        const params = {
          draw: currentPage,
          start: (currentPage - 1) * 100, // Assuming 100 items per page
          length: 100,
          'search[value]': '',
          'search[regex]': false,
          // Add year filter for 2025
          year: 2025
        };

        const headers = {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'no,en;q=0.5',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': this.apiUrl
        };

        if (csrfToken) {
          headers['X-CSRF-TOKEN'] = csrfToken;
        }

        const response = await axios.post(
          endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`,
          new URLSearchParams(params).toString(),
          { headers }
        );

        if (response.data && response.data.data) {
          const pageData = response.data.data;
          allDonations.push(...pageData);
          
          console.log(`✅ Page ${currentPage}: ${pageData.length} donations`);
          
          // Check if there are more pages
          const totalRecords = response.data.recordsTotal || 0;
          const currentRecords = (currentPage * 100);
          hasMorePages = currentRecords < totalRecords && pageData.length > 0;
          
          if (hasMorePages) {
            currentPage++;
            // Add delay to be respectful to the server
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else {
          hasMorePages = false;
        }
        
      } catch (error) {
        console.warn(`⚠️ Error fetching page ${currentPage}:`, error.message);
        hasMorePages = false;
      }
    }
    
    console.log(`📊 Total donations fetched: ${allDonations.length}`);
    return this.processDonationData(allDonations);
  }

  /**
   * Fetch data via form submission with filters
   */
  async fetchViaFormSubmission(formAction, csrfToken) {
    console.log('📋 Submitting form with year filter...');
    
    const formData = {
      year: 2025, // Filter for 2025 data
      parti: '', // All parties
      fylke: '', // All counties
      kommune: '' // All municipalities
    };

    if (csrfToken) {
      formData._token = csrfToken;
    }

    try {
      const response = await axios.post(
        formAction.startsWith('http') ? formAction : `${this.baseUrl}${formAction}`,
        new URLSearchParams(formData).toString(),
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': this.apiUrl
          }
        }
      );

      const $ = cheerio.load(response.data);
      return await this.parseFilteredResults($);
      
    } catch (error) {
      console.error('❌ Form submission failed:', error.message);
      throw error;
    }
  }

  /**
   * Process raw donation data from API response
   */
  processDonationData(rawDonations) {
    console.log('🔄 Processing donation data...');
    
    const donationData = {
      year: 2025,
      lastUpdated: new Date().toISOString(),
      source: 'partifinansiering.no (real data)',
      parties: {}
    };

    rawDonations.forEach(item => {
      // Handle different possible data structures from the API
      const year = item.year || item.aar || item[0];
      const donor = item.donor || item.bidragsyter || item[1];
      const party = item.party || item.parti || item[2];
      const amountText = item.amount || item.belop || item[3];
      
      const amount = this.parseAmount(amountText);
      const standardPartyName = this.partyNameMap[party] || party;
      
      if (amount > 0 && standardPartyName && year == 2025) {
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
          date: '2025-01-01', // Default date
          source: 'partifinansiering.no'
        });
      }
    });

    // Calculate totals
    Object.values(donationData.parties).forEach(party => {
      party.totalAmount = party.donations.reduce((sum, d) => sum + d.amount, 0);
      party.donorCount = party.donations.length;
    });

    return donationData;
  }

  /**
   * Parse filtered results from form submission
   */
  async parseFilteredResults($) {
    console.log('📊 Parsing filtered results...');
    
    // Look for data table with results
    const tables = $('table');
    if (tables.length > 0) {
      return await this.parseTableData($, tables);
    }
    
    // If no table, look for other data structures
    return await this.parseVisibleData($);
  }

  /**
   * Parse visible data from the page
   */
  async parseVisibleData($) {
    console.log('🔍 Parsing visible data...');
    
    const donationData = {
      year: 2025,
      lastUpdated: new Date().toISOString(),
      source: 'partifinansiering.no (visible data)',
      parties: {}
    };

    // Look for any visible donation data
    const rows = $('tr, .donation-row, [data-donation]');
    
    rows.each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td, .cell, [data-field]');
      
      if (cells.length >= 3) {
        const donor = $(cells[0]).text().trim();
        const party = $(cells[1]).text().trim();
        const amountText = $(cells[2]).text().trim();
        
        const amount = this.parseAmount(amountText);
        const standardPartyName = this.partyNameMap[party] || party;
        
        if (amount > 0 && standardPartyName) {
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
            date: '2025-01-01',
            source: 'partifinansiering.no'
          });
        }
      }
    });

    // Calculate totals
    Object.values(donationData.parties).forEach(party => {
      party.totalAmount = party.donations.reduce((sum, d) => sum + d.amount, 0);
      party.donorCount = party.donations.length;
    });

    return donationData;
  }

  /**
   * Parse table data from the HTML
   */
  async parseTableData($, tables) {
    console.log('📊 Parsing table data...');
    
    const donationData = {
      year: this.currentYear,
      lastUpdated: new Date().toISOString(),
      source: 'partifinansiering.no',
      parties: {}
    };

    tables.each((tableIndex, table) => {
      const rows = $(table).find('tr');
      
      rows.each((rowIndex, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 4) {
          // Typical structure: Year, Donor, Party, Amount
          const year = $(cells[0]).text().trim();
          const donor = $(cells[1]).text().trim();
          const party = $(cells[2]).text().trim();
          const amountText = $(cells[3]).text().trim();
          
          // Parse amount (remove currency symbols and spaces)
          const amount = this.parseAmount(amountText);
          
          if (amount > 0 && this.partyNameMap[party] && this.electionYears.includes(parseInt(year))) {
            const standardPartyName = this.partyNameMap[party];
            
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
              date: `${year}-01-01`, // Default date if not specified
              source: 'partifinansiering.no'
            });
          }
        }
      });
    });

    // Calculate totals
    Object.values(donationData.parties).forEach(party => {
      party.totalAmount = party.donations.reduce((sum, d) => sum + d.amount, 0);
      party.donorCount = party.donations.length;
    });

    return donationData;
  }

  /**
   * Fetch data from API endpoint
   */
  async fetchFromApi(endpoint) {
    console.log('🌐 Fetching from API endpoint...');
    
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });

      return this.processApiData(response.data);
    } catch (error) {
      console.error('❌ API request failed:', error.message);
      throw error;
    }
  }

  /**
   * Process API response data
   */
  processApiData(apiData) {
    console.log('🔄 Processing API data...');
    
    const donationData = {
      year: this.currentYear,
      lastUpdated: new Date().toISOString(),
      source: 'partifinansiering.no API',
      parties: {}
    };

    // Process the API response (structure depends on actual API)
    if (Array.isArray(apiData)) {
      apiData.forEach(item => {
        const party = this.partyNameMap[item.parti] || item.parti;
        const amount = this.parseAmount(item.belop || item.amount);
        
        if (party && amount > 0) {
          if (!donationData.parties[party]) {
            donationData.parties[party] = {
              name: party,
              donations: [],
              totalAmount: 0,
              donorCount: 0
            };
          }

          donationData.parties[party].donations.push({
            id: `${party.toLowerCase().replace(/\s+/g, '-')}-${donationData.parties[party].donations.length + 1}`,
            donor: item.bidragsyter || item.donor,
            amount: amount,
            date: item.dato || item.date || `${this.currentYear}-01-01`,
            source: 'partifinansiering.no'
          });
        }
      });
    }

    // Calculate totals
    Object.values(donationData.parties).forEach(party => {
      party.totalAmount = party.donations.reduce((sum, d) => sum + d.amount, 0);
      party.donorCount = party.donations.length;
    });

    return donationData;
  }

  /**
   * Scrape any visible donation data from the page
   */
  async scrapeVisibleData($) {
    console.log('🔍 Scraping visible data...');
    
    // Look for any donation-related content
    const donationElements = $('[data-amount], .amount, .belop, .bidrag');
    console.log(`📊 Found ${donationElements.length} potential donation elements`);

    // For now, return empty structure if we can't parse the data
    return {
      year: this.currentYear,
      lastUpdated: new Date().toISOString(),
      source: 'partifinansiering.no (limited scraping)',
      parties: {},
      note: 'Real-time scraping from partifinansiering.no requires further analysis of their data structure'
    };
  }

  /**
   * Parse amount from Norwegian currency format
   */
  parseAmount(amountText) {
    if (!amountText) return 0;
    
    // Remove common currency symbols and text
    const cleaned = amountText
      .replace(/kr/gi, '')
      .replace(/nok/gi, '')
      .replace(/\s/g, '')
      .replace(/,/g, '');
    
    const amount = parseInt(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Calculate comprehensive statistics
   */
  async calculateStatistics(donationData = null) {
    console.log('📊 Calculating donation statistics...');

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

    // Calculate statistics for each party
    for (const [partyName, partyData] of Object.entries(donationData.parties)) {
      const amounts = partyData.donations.map(d => d.amount);
      const sortedAmounts = [...amounts].sort((a, b) => a - b);
      
      const stats = {
        name: partyName,
        donorCount: partyData.donorCount,
        totalAmount: partyData.totalAmount,
        meanDonation: partyData.donorCount > 0 ? Math.round(partyData.totalAmount / partyData.donorCount) : 0,
        medianDonation: this.calculateMedian(sortedAmounts),
        top10PercentThreshold: this.calculatePercentile(sortedAmounts, 90),
        top5PercentThreshold: this.calculatePercentile(sortedAmounts, 95),
        smallestDonation: amounts.length > 0 ? Math.min(...amounts) : 0,
        largestDonation: amounts.length > 0 ? Math.max(...amounts) : 0,
      };

      statistics.parties[partyName] = stats;
      totalDonations += partyData.donorCount;
      totalAmount += partyData.totalAmount;
      allAmounts.push(...amounts);
    }

    // Calculate overall statistics
    const sortedAllAmounts = allAmounts.sort((a, b) => a - b);
    statistics.overview = {
      totalParties: Object.keys(donationData.parties).length,
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
    console.log('\n=== REAL NORWEGIAN POLITICAL PARTY DONATIONS ANALYSIS ===');
    console.log(`Year: ${statistics.year}`);
    console.log(`Source: ${statistics.source}`);
    console.log(`Last Updated: ${new Date(statistics.lastUpdated).toLocaleDateString('no-NO')}`);
    
    if (Object.keys(statistics.parties).length === 0) {
      console.log('\n⚠️  No donation data found for the current year.');
      console.log('This could mean:');
      console.log('- No donations have been reported yet');
      console.log('- The website structure has changed');
      console.log('- Data is not yet available for this year');
      return;
    }
    
    console.log('\n--- OVERALL STATISTICS ---');
    console.log(`Total Donations: ${statistics.overview.totalDonations.toLocaleString('no-NO')}`);
    console.log(`Total Amount: ${this.formatCurrency(statistics.overview.totalAmount)}`);
    console.log(`Average Donation: ${this.formatCurrency(statistics.overview.averageDonationSize)}`);
    console.log(`Median Donation: ${this.formatCurrency(statistics.overview.medianDonationSize)}`);
    
    console.log('\n--- PARTY BREAKDOWN ---');
    const sortedParties = Object.values(statistics.parties)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    sortedParties.forEach((party, index) => {
      console.log(`\n${index + 1}. ${party.name}`);
      console.log(`   Donors: ${party.donorCount.toLocaleString('no-NO')}`);
      console.log(`   Total: ${this.formatCurrency(party.totalAmount)}`);
      console.log(`   Mean: ${this.formatCurrency(party.meanDonation)}`);
      console.log(`   Median: ${this.formatCurrency(party.medianDonation)}`);
      console.log(`   Largest: ${this.formatCurrency(party.largestDonation)}`);
    });
  }

  async saveStatistics(statistics) {
    const statsPath = path.join(__dirname, '..', 'data', 'real-donation-statistics.json');
    await fs.writeFile(statsPath, JSON.stringify(statistics, null, 2));
    console.log(`\n📄 Real statistics saved to ${statsPath}`);
  }

  async run() {
    try {
      console.log('🚀 Starting REAL donation analysis...\n');
      
      // Fetch real donation data
      const donationData = await this.fetchRealDonationData();
      await fs.writeFile(this.dataPath, JSON.stringify(donationData, null, 2));
      
      // Calculate comprehensive statistics
      const statistics = await this.calculateStatistics(donationData);
      
      // Generate and display report
      this.generateReport(statistics);
      
      // Save statistics for web app
      await this.saveStatistics(statistics);
      
      console.log('\n✅ Real donation analysis complete!');
      console.log('📊 Data source: https://www.partifinansiering.no/nb/bidrag-i-valgar/');
      
    } catch (error) {
      console.error('❌ Error during real donation analysis:', error.message);
      console.log('💡 Falling back to simulated data for demonstration purposes');
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fetcher = new RealDonationFetcher();
  fetcher.run();
}

module.exports = RealDonationFetcher;
    