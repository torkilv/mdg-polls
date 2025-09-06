import React, { useEffect, useState } from 'react';
import './App.css';
import ElectionChart from './components/ElectionChart';
import UnifiedTimelineChart from './components/UnifiedTimelineChart';
import ShortTimelineChart from './components/ShortTimelineChart';
import Corrected2025Chart from './components/Corrected2025Chart';
import DonationAnalysis from './components/DonationAnalysis';
import { ElectionData } from './types';
import fallbackData from './data/polling-data.json';

function App() {
  const [electionData, setElectionData] = useState<ElectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try to fetch polling data from the public JSON file
        const response = await fetch(`${process.env.PUBLIC_URL}/data/polling-data.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch polling data: ${response.status} ${response.statusText}`);
        }
        
        const text = await response.text();
        console.log('Successfully fetched data from public directory');
        
        const data: ElectionData = JSON.parse(text);
        setElectionData(data);
      } catch (err) {
        console.warn('Failed to fetch from public directory, using fallback data:', err);
        // Use fallback data imported directly
        setElectionData(fallbackData as ElectionData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading MDG polling data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  if (!electionData || !electionData.elections) {
    return (
      <div className="app">
        <div className="error">No polling data available</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>MDG Polling Analysis</h1>
        <p>Norwegian election polling trends and predictions</p>
      </header>
      
      <main className="app-main">
        {/* Short Timeline Chart - Final 50 Days */}
        <div className="unified-section">
          <h2>Final 50 Days</h2>
          <ShortTimelineChart data={electionData} />
        </div>

        {/* Unified Timeline Chart */}
        <div className="unified-section">
          <h2>Historical Analysis</h2>
          <UnifiedTimelineChart electionData={electionData} />
        </div>

        {/* Individual Election Charts */}
        <div className="individual-elections">
          <h2>Individual Elections</h2>
          {Object.entries(electionData.elections)
            .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by year, newest first
            .map(([year, data]) => (
              <div key={year} className="election-section">
                <h3>{year}</h3>
                <p className="election-date">{data.electionDate}</p>
                <ElectionChart electionYear={parseInt(year)} electionData={data} />
              </div>
            ))}
        </div>

        {/* Donation Analysis */}
        <div className="unified-section">
          <h2>Party Donations</h2>
          <DonationAnalysis />
        </div>

        {/* Bias-Corrected 2025 Chart */}
        <div className="unified-section">
          <h2>2025 Bias-Corrected</h2>
          <Corrected2025Chart electionData={electionData} />
        </div>
      </main>
      
      <footer className="app-footer">
        <p>
          Data source: <a href="https://www.pollofpolls.no" target="_blank" rel="noopener noreferrer">pollofpolls.no</a>
          {' | '}
          <a href="https://github.com/torkilvederhus/mdg-elections-compare" target="_blank" rel="noopener noreferrer">
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
