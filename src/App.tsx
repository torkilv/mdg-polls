import React, { useEffect, useState } from 'react';
import './App.css';
import ElectionChart from './components/ElectionChart';
import UnifiedTimelineChart from './components/UnifiedTimelineChart';
import ShortTimelineChart from './components/ShortTimelineChart';
import Corrected2025Chart from './components/Corrected2025Chart';
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
        <h1>MDG Election Polling Comparison</h1>
        <p>Track MDG's polling performance in the 24 months leading up to Norwegian parliamentary elections</p>
      </header>
      
      <main className="app-main">
        {/* Short Timeline Chart - Final 50 Days */}
        <div className="unified-section">
          <h2>Final 50 Days - Polling Trends</h2>
          <p className="section-description">
            Focus on the critical final 50 days before each election with individual polls (dots), 7-day rolling averages (lines), and June baselines (dashed lines)
          </p>
          <ShortTimelineChart data={electionData} />
        </div>

        {/* Unified Timeline Chart */}
        <div className="unified-section">
          <h2>Full Campaign Timeline Analysis</h2>
          <p className="section-description">
            All election cycles aligned by days until election day - complete 24-month view of MDG's polling trends
          </p>
          <UnifiedTimelineChart electionData={electionData} />
        </div>

        {/* Individual Election Charts */}
        <div className="individual-elections">
          <h2>Individual Election Cycles</h2>
          <p className="section-description">
            Detailed view of each election cycle with chronological timeline
          </p>
          {Object.entries(electionData.elections)
            .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by year, newest first
            .map(([year, data]) => (
              <div key={year} className="election-section">
                <h3>{year} Parliamentary Election</h3>
                <p className="election-date">Election Date: {data.electionDate}</p>
                <ElectionChart electionYear={parseInt(year)} electionData={data} />
              </div>
            ))}
        </div>

        {/* Bias-Corrected 2025 Chart */}
        <div className="unified-section">
          <h2>2025 Bias-Corrected Polling</h2>
          <p className="section-description">
            2025 polls adjusted using each pollster's systematic error from 2021. Shows what the polls might look like after accounting for historical bias patterns.
          </p>
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
