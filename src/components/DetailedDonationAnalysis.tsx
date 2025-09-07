import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './DonationAnalysis.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface DonorTypeBreakdown {
  count: number;
  amount: number;
  percentage: number;
  amountPercentage: number;
  topDonors: Array<{
    name: string;
    amount: number;
  }>;
}

interface PartyDonationData {
  name: string;
  totalDonations: number;
  totalAmount: number;
  donorTypeBreakdown: {
    unions?: DonorTypeBreakdown;
    companies?: DonorTypeBreakdown;
    individuals?: DonorTypeBreakdown;
    organizations?: DonorTypeBreakdown;
    partyOrganizations?: DonorTypeBreakdown;
    other?: DonorTypeBreakdown;
  };
}

interface DetailedDonationData {
  year: number;
  lastUpdated: string;
  source: string;
  parties: { [key: string]: PartyDonationData };
}

const DetailedDonationAnalysis: React.FC = () => {
  const [donationData, setDonationData] = useState<DetailedDonationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDonationData = async () => {
      try {
        const response = await fetch(`${process.env.PUBLIC_URL}/data/donor-type-analysis.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch detailed donation data: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        setDonationData(data);
      } catch (err) {
        console.error('Error fetching detailed donation data:', err);
        setError('Unable to load detailed donation data. Please run the analysis script.');
      } finally {
        setLoading(false);
      }
    };

    fetchDonationData();
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('no-NO').format(num);
  };

  const getCategoryName = (key: string): string => {
    const names: { [key: string]: string } = {
      unions: 'Labor Unions',
      companies: 'Companies',
      individuals: 'Individual Donors',
      organizations: 'Other Organizations',
      partyOrganizations: 'Party Organizations',
      other: 'Other/Unknown'
    };
    return names[key] || key;
  };

  const getCategoryColor = (key: string): string => {
    const colors: { [key: string]: string } = {
      unions: '#e74c3c',
      companies: '#3498db', 
      individuals: '#2ecc71',
      organizations: '#f39c12',
      partyOrganizations: '#9b59b6',
      other: '#95a5a6'
    };
    return colors[key] || '#95a5a6';
  };

  if (loading) {
    return <div className="donation-analysis"><div className="loading">Loading detailed donation data...</div></div>;
  }

  if (error || !donationData) {
    return <div className="donation-analysis"><div className="error">{error || 'No detailed donation data available'}</div></div>;
  }

  // Sort parties by total amount (major parties only)
  const majorParties = ['Arbeiderpartiet', 'Fremskrittspartiet', 'Høyre', 'Venstre', 'Sosialistisk Venstreparti', 'Kristelig Folkeparti', 'Miljøpartiet De Grønne', 'Senterpartiet', 'Rødt'];
  const parties = Object.values(donationData.parties)
    .filter(party => majorParties.includes(party.name))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return (
    <div className="donation-analysis">
      <div className="analysis-header">
        <h2>Political Party Donations {donationData.year} 🇳🇴</h2>
        <p className="data-subtitle">Detailed donor type analysis from partifinansiering.no</p>
        <p className="last-updated">Last updated: {new Date(donationData.lastUpdated).toLocaleDateString('no-NO')}</p>
      </div>

      <div className="donor-type-breakdown">
        {parties.map((party, index) => (
          <div key={party.name} className="party-breakdown">
            <div className="party-header">
              <h3>{index + 1}. {party.name === 'Miljøpartiet De Grønne' ? 'MDG' : party.name}</h3>
              <div className="party-totals">
                <span className="total-donations">{formatNumber(party.totalDonations)} donations</span>
                <span className="total-amount">{formatCurrency(party.totalAmount)}</span>
              </div>
            </div>

            <div className="donor-categories">
              {Object.entries(party.donorTypeBreakdown)
                .sort(([,a], [,b]) => b.amountPercentage - a.amountPercentage)
                .map(([categoryKey, category]) => (
                <div key={categoryKey} className="donor-category">
                  <div className="category-header">
                    <div className="category-info">
                      <span 
                        className="category-dot" 
                        style={{ backgroundColor: getCategoryColor(categoryKey) }}
                      ></span>
                      <span className="category-name">{getCategoryName(categoryKey)}</span>
                    </div>
                    <div className="category-stats">
                      <span className="donor-count">{category.count} donors ({category.percentage}%)</span>
                      <span className="category-amount">{formatCurrency(category.amount)} ({category.amountPercentage}%)</span>
                    </div>
                  </div>
                  
                  {category.topDonors.length > 0 && (
                    <div className="top-donors">
                      {category.topDonors.slice(0, 3).map((donor, i) => (
                        <div key={i} className="top-donor">
                          <span className="donor-rank">{i + 1}.</span>
                          <span className="donor-name">{donor.name}</span>
                          <span className="donor-amount">
                            {donor.amount >= 1000000 
                              ? `${(donor.amount/1000000).toFixed(1)}M NOK`
                              : `${Math.round(donor.amount/1000)}k NOK`
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="data-insights">
        <h3>Key Insights</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <h4>Labor Union Influence</h4>
            <p>Arbeiderpartiet receives 83% of funding from unions (38M NOK), while SV gets 73% (11M NOK). This reflects traditional Norwegian labor-left political alliances.</p>
          </div>
          
          <div className="insight-card">
            <h4>Business Support</h4>
            <p>Right-wing parties like Høyre (75% from companies) and FrP (45% from companies) receive significant business funding, with major donations from Sundt AS, Watrium AS, and others.</p>
          </div>
          
          <div className="insight-card">
            <h4>Grassroots vs. Institutional</h4>
            <p>MDG shows the most grassroots support with 88% individual donors, while established parties rely more on institutional funding from unions, companies, and party organizations.</p>
          </div>
          
          <div className="insight-card">
            <h4>Party Organizations</h4>
            <p>Regional and local party branches contribute significantly to their national organizations, showing internal party coordination in fundraising efforts.</p>
          </div>
        </div>
      </div>

      <div className="data-source">
        <h4>Data Source & Methodology</h4>
        <p><strong>Real Data:</strong> This analysis uses official donation data from <a href="https://www.partifinansiering.no" target="_blank" rel="noopener noreferrer">partifinansiering.no</a>, 
           Norway's official registry for political party financing. All donations over NOK 10,000 must be publicly reported by law.</p>
        
        <p><strong>Donor Classification:</strong> Donors are categorized as labor unions, companies, individuals, other organizations, 
           party organizations (regional/local branches), and other/unknown based on name patterns and organizational structure.</p>
        
        <p><strong>Coverage:</strong> Analysis focuses on the 9 major parliamentary parties. 
           Regional and local party donations are aggregated under their national organizations where appropriate.</p>
      </div>
    </div>
  );
};

export default DetailedDonationAnalysis;
