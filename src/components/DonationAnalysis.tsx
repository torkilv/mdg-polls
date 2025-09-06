import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './DonationAnalysis.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface DonationStats {
  name: string;
  donorCount: number;
  totalAmount: number;
  meanDonation: number;
  medianDonation: number;
  top10PercentThreshold: number;
  largestDonation: number;
  organizationDonations: number;
  individualDonations: number;
}

interface DonationData {
  year: number;
  lastUpdated: string;
  overview: {
    totalDonations: number;
    totalAmount: number;
    averageDonationSize: number;
    medianDonationSize: number;
    top10PercentThreshold: number;
  };
  parties: { [key: string]: DonationStats };
}

const DonationAnalysis: React.FC = () => {
  const [donationData, setDonationData] = useState<DonationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDonationData = async () => {
      try {
        // Try to fetch donation statistics from the public JSON file
        const response = await fetch(`${process.env.PUBLIC_URL}/data/donation-statistics.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch donation data: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        setDonationData(data);
      } catch (err) {
        console.error('Error fetching donation data:', err);
        setError('Unable to load donation data. The data may not be available yet.');
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

  if (loading) {
    return <div className="donation-analysis"><div className="loading">Loading donation data...</div></div>;
  }

  if (error || !donationData) {
    return <div className="donation-analysis"><div className="error">{error || 'No donation data available'}</div></div>;
  }

  const parties = Object.values(donationData.parties).sort((a, b) => b.totalAmount - a.totalAmount);
  
  const totalAmountData = {
    labels: parties.map(p => p.name.replace('Miljøpartiet De Grønne', 'MDG')),
    datasets: [{
      label: 'Total Donations',
      data: parties.map(p => p.totalAmount),
      backgroundColor: ['#e31e24', '#0065f1', '#00843d', '#003d82', '#bf2126', '#d30707', '#006666', '#f4a100', '#4d9221'],
      borderWidth: 1,
    }],
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context) {
            return formatCurrency(context.parsed.y);
          }
        }
      }
    },
    scales: {
      x: { ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } } },
      y: { ticks: { callback: function(value) { return formatCurrency(value as number); } } }
    }
  };

  return (
    <div className="donation-analysis">
      <div className="analysis-header">
        <h2>Political Party Donations {donationData.year}</h2>
        <p className="last-updated">Last updated: {new Date(donationData.lastUpdated).toLocaleDateString('no-NO')}</p>
      </div>

      <div className="overview-stats">
        <div className="stat-card">
          <h3>Total Donations</h3>
          <div className="stat-value">{formatNumber(donationData.overview.totalDonations)}</div>
        </div>
        <div className="stat-card">
          <h3>Total Amount</h3>
          <div className="stat-value">{formatCurrency(donationData.overview.totalAmount)}</div>
        </div>
        <div className="stat-card">
          <h3>Average Donation</h3>
          <div className="stat-value">{formatCurrency(donationData.overview.averageDonationSize)}</div>
        </div>
        <div className="stat-card">
          <h3>Median Donation</h3>
          <div className="stat-value">{formatCurrency(donationData.overview.medianDonationSize)}</div>
        </div>
      </div>

      <div className="chart-section">
        <h3>Total Donation Amount by Party</h3>
        <div className="chart-wrapper">
          <Bar data={totalAmountData} options={chartOptions} />
        </div>
      </div>

      <div className="detailed-stats">
        <h3>Detailed Statistics</h3>
        <div className="stats-table">
          <div className="table-header">
            <div>Party</div><div>Donors</div><div>Total</div><div>Mean</div><div>Median</div><div>Top 10%</div><div>Largest</div>
          </div>
          {parties.map((party, index) => (
            <div key={party.name} className="table-row">
              <div className="party-name">{index + 1}. {party.name === 'Miljøpartiet De Grønne' ? 'MDG' : party.name}</div>
              <div>{formatNumber(party.donorCount)}</div>
              <div>{formatCurrency(party.totalAmount)}</div>
              <div>{formatCurrency(party.meanDonation)}</div>
              <div>{formatCurrency(party.medianDonation)}</div>
              <div>{formatCurrency(party.top10PercentThreshold)}</div>
              <div>{formatCurrency(party.largestDonation)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="methodology">
        <h4>Methodology</h4>
        <p>This analysis is based on simulated donation data following Norwegian political financing patterns. 
           In Norway, donations over NOK 10,000 must be publicly reported. Real data would be sourced from 
           partifinansiering.no and Statistics Norway (SSB).</p>
      </div>
    </div>
  );
};

export default DonationAnalysis;
