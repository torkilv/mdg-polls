const fs = require('fs').promises;
const path = require('path');

class DonationDataVerifier {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'data', 'real-api-donation-data.json');
  }

  async verifyData() {
    console.log('🔍 DONATION DATA VERIFICATION REPORT\n');
    
    try {
      const data = JSON.parse(await fs.readFile(this.dataPath, 'utf8'));
      
      // 1. Check for duplicate donations
      await this.checkForDuplicates(data);
      
      // 2. Verify party name aggregation
      await this.verifyPartyAggregation(data);
      
      // 3. Check for suspicious amounts
      await this.checkSuspiciousAmounts(data);
      
      // 4. Verify date ranges
      await this.verifyDates(data);
      
      // 5. Check for data consistency
      await this.checkDataConsistency(data);
      
      // 6. Generate verification URLs
      await this.generateVerificationUrls(data);
      
    } catch (error) {
      console.error('❌ Verification failed:', error.message);
    }
  }

  async checkForDuplicates(data) {
    console.log('1. 🔍 CHECKING FOR DUPLICATE DONATIONS');
    
    const allDonations = [];
    const duplicates = [];
    
    Object.values(data.parties).forEach(party => {
      party.donations.forEach(donation => {
        const key = `${donation.donor}-${donation.amount}-${donation.receivedDate}`;
        if (allDonations.includes(key)) {
          duplicates.push({ party: party.name, donation });
        }
        allDonations.push(key);
      });
    });
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} potential duplicates:`);
      duplicates.forEach(dup => {
        console.log(`   ${dup.party}: ${dup.donation.donor} - ${dup.donation.amount} NOK`);
      });
    } else {
      console.log('✅ No duplicates found');
    }
    console.log('');
  }

  async verifyPartyAggregation(data) {
    console.log('2. 🏛️  VERIFYING PARTY NAME AGGREGATION');
    
    // Check if we're missing any obvious party variations
    const originalPartyNames = new Set();
    Object.values(data.parties).forEach(party => {
      party.donations.forEach(donation => {
        // This would need the original party name from API, which we don't store
        // This is a limitation we should fix
      });
    });
    
    // Check for reasonable aggregation
    const partyCounts = Object.entries(data.parties).map(([name, party]) => ({
      name,
      donations: party.donations.length,
      amount: party.totalAmount
    })).sort((a, b) => b.amount - a.amount);
    
    console.log('Party aggregation results:');
    partyCounts.forEach(party => {
      console.log(`   ${party.name}: ${party.donations} donations, ${(party.amount/1000000).toFixed(1)}M NOK`);
    });
    console.log('');
  }

  async checkSuspiciousAmounts(data) {
    console.log('3. 💰 CHECKING FOR SUSPICIOUS AMOUNTS');
    
    const allAmounts = [];
    const veryLarge = [];
    const roundNumbers = [];
    
    Object.values(data.parties).forEach(party => {
      party.donations.forEach(donation => {
        allAmounts.push(donation.amount);
        
        // Check for very large donations (>10M)
        if (donation.amount > 10000000) {
          veryLarge.push({ party: party.name, donation });
        }
        
        // Check for suspiciously round numbers
        if (donation.amount % 1000000 === 0 && donation.amount > 1000000) {
          roundNumbers.push({ party: party.name, donation });
        }
      });
    });
    
    console.log(`💸 Very large donations (>10M NOK): ${veryLarge.length}`);
    veryLarge.forEach(item => {
      console.log(`   ${item.party}: ${item.donation.donor} - ${(item.donation.amount/1000000).toFixed(1)}M NOK`);
    });
    
    console.log(`🎯 Round million amounts: ${roundNumbers.length}`);
    roundNumbers.slice(0, 5).forEach(item => {
      console.log(`   ${item.party}: ${item.donation.donor} - ${(item.donation.amount/1000000).toFixed(1)}M NOK`);
    });
    
    const stats = {
      total: allAmounts.length,
      min: Math.min(...allAmounts),
      max: Math.max(...allAmounts),
      avg: Math.round(allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length)
    };
    
    console.log(`📊 Amount statistics: ${stats.total} donations, ${stats.min}-${stats.max} NOK, avg ${stats.avg} NOK`);
    console.log('');
  }

  async verifyDates(data) {
    console.log('4. 📅 VERIFYING DATES');
    
    const dates = [];
    const invalidDates = [];
    
    Object.values(data.parties).forEach(party => {
      party.donations.forEach(donation => {
        const receivedDate = new Date(donation.receivedDate);
        const reportedDate = new Date(donation.reportedDate);
        
        if (isNaN(receivedDate.getTime()) || isNaN(reportedDate.getTime())) {
          invalidDates.push({ party: party.name, donation });
        } else {
          dates.push(receivedDate);
          
          // Check if reported after received (should be)
          if (reportedDate < receivedDate) {
            console.log(`⚠️  ${party.name}: Reported before received - ${donation.donor}`);
          }
        }
      });
    });
    
    if (invalidDates.length > 0) {
      console.log(`❌ Invalid dates found: ${invalidDates.length}`);
    } else {
      console.log('✅ All dates valid');
    }
    
    const sortedDates = dates.sort();
    console.log(`📅 Date range: ${sortedDates[0].toISOString().split('T')[0]} to ${sortedDates[sortedDates.length-1].toISOString().split('T')[0]}`);
    console.log('');
  }

  async checkDataConsistency(data) {
    console.log('5. 🔄 CHECKING DATA CONSISTENCY');
    
    Object.entries(data.parties).forEach(([partyName, party]) => {
      const calculatedTotal = party.donations.reduce((sum, d) => sum + d.amount, 0);
      const calculatedCount = party.donations.length;
      
      if (calculatedTotal !== party.totalAmount) {
        console.log(`❌ ${partyName}: Total mismatch - calculated ${calculatedTotal}, stored ${party.totalAmount}`);
      }
      
      if (calculatedCount !== party.donorCount) {
        console.log(`❌ ${partyName}: Count mismatch - calculated ${calculatedCount}, stored ${party.donorCount}`);
      }
    });
    
    console.log('✅ Data consistency checks completed');
    console.log('');
  }

  async generateVerificationUrls(data) {
    console.log('6. 🔗 VERIFICATION URLS FOR MANUAL CHECKING');
    
    // Generate URLs to manually verify largest donations
    const largestDonations = [];
    Object.values(data.parties).forEach(party => {
      party.donations.forEach(donation => {
        if (donation.amount > 1000000) {
          largestDonations.push({ party: party.name, donation });
        }
      });
    });
    
    largestDonations.sort((a, b) => b.donation.amount - a.donation.amount);
    
    console.log('Top 10 donations to manually verify on partifinansiering.no:');
    largestDonations.slice(0, 10).forEach((item, i) => {
      const donor = encodeURIComponent(item.donation.donor);
      const party = encodeURIComponent(item.party);
      console.log(`${i+1}. ${item.party}: ${item.donation.donor} - ${(item.donation.amount/1000000).toFixed(1)}M NOK`);
      console.log(`   Verify: https://www.partifinansiering.no/nb/bidrag-i-valgar/?year=2025&name=${donor}`);
    });
    console.log('');
  }
}

if (require.main === module) {
  const verifier = new DonationDataVerifier();
  verifier.verifyData();
}

module.exports = DonationDataVerifier;
