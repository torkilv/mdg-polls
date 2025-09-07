const fs = require('fs').promises;
const path = require('path');

class DonorTypeAnalyzer {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'data', 'real-api-donation-data.json');
  }

  async analyzeDonorTypes() {
    console.log('🔍 ANALYZING DONOR TYPES BY PARTY\n');
    
    try {
      const data = JSON.parse(await fs.readFile(this.dataPath, 'utf8'));
      
      const partyAnalysis = {};
      
      Object.entries(data.parties).forEach(([partyName, party]) => {
        partyAnalysis[partyName] = {
          name: partyName,
          totalDonations: party.donations.length,
          totalAmount: party.totalAmount,
          donorTypes: {
            unions: { count: 0, amount: 0, donors: [] },
            companies: { count: 0, amount: 0, donors: [] },
            individuals: { count: 0, amount: 0, donors: [] },
            organizations: { count: 0, amount: 0, donors: [] },
            partyOrganizations: { count: 0, amount: 0, donors: [] },
            other: { count: 0, amount: 0, donors: [] }
          }
        };
        
        party.donations.forEach(donation => {
          const donor = donation.donor;
          const donorLower = donor.toLowerCase();
          const amount = donation.amount;
          const originalParty = donation.originalPartyName || '';
          
          let category = 'other';
          
          // Check if it's a party organization (different levels of the same party)
          if (this.isPartyOrganization(originalParty, partyName)) {
            category = 'partyOrganizations';
          }
          // Check for unions
          else if (this.isUnion(donorLower)) {
            category = 'unions';
          }
          // Check for companies
          else if (this.isCompany(donorLower)) {
            category = 'companies';
          }
          // Check for organizations
          else if (this.isOrganization(donorLower)) {
            category = 'organizations';
          }
          // Check for individuals (has typical name pattern)
          else if (this.isIndividual(donor)) {
            category = 'individuals';
          }
          
          partyAnalysis[partyName].donorTypes[category].count++;
          partyAnalysis[partyName].donorTypes[category].amount += amount;
          partyAnalysis[partyName].donorTypes[category].donors.push({
            name: donor,
            amount: amount,
            originalParty: originalParty
          });
        });
        
        // Sort donors by amount within each category
        Object.values(partyAnalysis[partyName].donorTypes).forEach(category => {
          category.donors.sort((a, b) => b.amount - a.amount);
        });
      });
      
      return partyAnalysis;
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      return {};
    }
  }

  isPartyOrganization(originalParty, mainParty) {
    if (!originalParty) return false;
    
    const original = originalParty.toLowerCase();
    const main = mainParty.toLowerCase();
    
    // Check if it's a regional/local/youth version of the same party
    const partyKeywords = {
      'arbeiderpartiet': ['arbeiderparti', 'arbeidarparti', 'auf'],
      'høyre': ['høyre', 'høgre', 'unge høyre'],
      'senterpartiet': ['senterparti', 'senterungdommen'],
      'fremskrittspartiet': ['fremskrittsparti', 'frp', 'fremskrittspartiets ungdom'],
      'sosialistisk venstreparti': ['sosialistisk venstreparti', 'sv', 'sosialistisk ungdom'],
      'rødt': ['rødt', 'rød ungdom'],
      'venstre': ['venstre', 'unge venstre'],
      'kristelig folkeparti': ['kristelig folkeparti', 'kristeleg folkeparti', 'krf'],
      'miljøpartiet de grønne': ['miljøpartiet de grønne', 'mdg', 'grønn ungdom']
    };
    
    const keywords = partyKeywords[main];
    if (!keywords) return false;
    
    return keywords.some(keyword => original.includes(keyword)) && 
           (original.includes('oslo') || original.includes('bergen') || original.includes('trondheim') ||
            original.includes('stavanger') || original.includes('kristiansand') || original.includes('tromsø') ||
            original.includes('agder') || original.includes('vestland') || original.includes('rogaland') ||
            original.includes('nordland') || original.includes('trøndelag') || original.includes('møre') ||
            original.includes('buskerud') || original.includes('vestfold') || original.includes('telemark') ||
            original.includes('innlandet') || original.includes('østfold') || original.includes('ungdom') ||
            original.includes('akershus') || original.includes('finnmark') || original.includes('troms'));
  }

  isUnion(donor) {
    const unionKeywords = [
      'forbund', 'landsorganisasjonen', 'fagforbundet', 'fellesforbundet',
      'sjømannsforbund', 'jernbaneforbund', 'lærerforbund', 'sykepleierforbund'
    ];
    return unionKeywords.some(keyword => donor.includes(keyword));
  }

  isCompany(donor) {
    const companyKeywords = [' as', ' asa', 'aksjeselskap', ' ab', ' ab ', ' inc', ' ltd'];
    return companyKeywords.some(keyword => donor.includes(keyword));
  }

  isOrganization(donor) {
    const orgKeywords = [
      'organisasjon', 'stiftelse', 'forening', 'rådet', 'aksjon', 'tankesmien',
      'landsrådet', 'forbundet', 'selskap', 'gruppe', 'institutt'
    ];
    return orgKeywords.some(keyword => donor.includes(keyword)) && !this.isUnion(donor);
  }

  isIndividual(donor) {
    // Simple heuristic: has 2-4 words, all letters, typical Norwegian name pattern
    const words = donor.trim().split(/\s+/);
    if (words.length < 2 || words.length > 4) return false;
    
    // Check if all words are letters (Norwegian characters included)
    const namePattern = /^[a-zæøåA-ZÆØÅ\s\-']+$/;
    return namePattern.test(donor) && !donor.toLowerCase().includes(' as') && 
           !donor.toLowerCase().includes('stiftelse') && !donor.toLowerCase().includes('organisasjon');
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  async generateDetailedReport() {
    const analysis = await this.analyzeDonorTypes();
    
    // Sort parties by total amount
    const sortedParties = Object.values(analysis).sort((a, b) => b.totalAmount - a.totalAmount);
    
    console.log('📊 DETAILED DONOR TYPE ANALYSIS BY PARTY\n');
    console.log('==========================================\n');
    
    sortedParties.forEach((party, index) => {
      console.log(`${index + 1}. ${party.name.toUpperCase()}`);
      console.log(`Total: ${party.totalDonations} donations, ${this.formatCurrency(party.totalAmount)}`);
      console.log('');
      
      const categories = [
        { key: 'partyOrganizations', name: 'Party Organizations (Regional/Youth)' },
        { key: 'unions', name: 'Labor Unions' },
        { key: 'companies', name: 'Companies' },
        { key: 'organizations', name: 'Other Organizations' },
        { key: 'individuals', name: 'Individual Donors' },
        { key: 'other', name: 'Other/Unknown' }
      ];
      
      categories.forEach(cat => {
        const data = party.donorTypes[cat.key];
        if (data.count > 0) {
          const percentage = Math.round((data.count / party.totalDonations) * 100);
          const amountPercentage = Math.round((data.amount / party.totalAmount) * 100);
          
          console.log(`  ${cat.name}: ${data.count} donors (${percentage}%), ${this.formatCurrency(data.amount)} (${amountPercentage}%)`);
          
          // Show top 3 donors in this category
          if (data.donors.length > 0) {
            const topDonors = data.donors.slice(0, 3);
            topDonors.forEach((donor, i) => {
              const displayAmount = donor.amount >= 1000000 ? 
                `${(donor.amount/1000000).toFixed(1)}M` : 
                `${Math.round(donor.amount/1000)}k`;
              console.log(`    ${i+1}. ${donor.name}: ${displayAmount} NOK`);
            });
          }
          console.log('');
        }
      });
      
      console.log('---\n');
    });
    
    // Generate summary statistics for the React component
    return this.generateComponentData(analysis);
  }

  async generateComponentData(analysis) {
    const componentData = {
      year: 2025,
      lastUpdated: new Date().toISOString(),
      source: 'partifinansiering.no (detailed donor type analysis)',
      parties: {}
    };

    Object.entries(analysis).forEach(([partyName, party]) => {
      componentData.parties[partyName] = {
        name: partyName,
        totalDonations: party.totalDonations,
        totalAmount: party.totalAmount,
        donorTypeBreakdown: {}
      };

      Object.entries(party.donorTypes).forEach(([type, data]) => {
        if (data.count > 0) {
          componentData.parties[partyName].donorTypeBreakdown[type] = {
            count: data.count,
            amount: data.amount,
            percentage: Math.round((data.count / party.totalDonations) * 100),
            amountPercentage: Math.round((data.amount / party.totalAmount) * 100),
            topDonors: data.donors.slice(0, 3).map(d => ({
              name: d.name,
              amount: d.amount
            }))
          };
        }
      });
    });

    // Save to file for React component
    const outputPath = path.join(__dirname, '..', 'data', 'donor-type-analysis.json');
    await fs.writeFile(outputPath, JSON.stringify(componentData, null, 2));
    console.log(`💾 Saved detailed analysis to ${outputPath}`);
    
    return componentData;
  }
}

if (require.main === module) {
  const analyzer = new DonorTypeAnalyzer();
  analyzer.generateDetailedReport();
}

module.exports = DonorTypeAnalyzer;
