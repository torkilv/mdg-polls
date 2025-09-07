import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ScatterController,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { ElectionData } from '../types';
import { calculateRollingAverage } from '../utils/rollingAverage';
import { useIsMobile } from '../hooks/useIsMobile';
import './UnifiedTimelineChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  ScatterController
);

interface UnifiedTimelineChartProps {
  electionData: ElectionData;
}

const UnifiedTimelineChart: React.FC<UnifiedTimelineChartProps> = ({ electionData }) => {
  const isMobile = useIsMobile();
  
  // Color palette for different election years
  const colorPalette: { [key: string]: string } = {
    '2011': '#ef4444', // Red
    '2013': '#f97316', // Orange  
    '2017': '#eab308', // Yellow
    '2021': '#22c55e', // Green
    '2025': '#3b82f6', // Blue
  };

  // Prepare datasets for each election
  const datasets: any[] = [];
  
  Object.entries(electionData.elections)
    .sort(([a], [b]) => parseInt(a) - parseInt(b)) // Sort by year
    .forEach(([year, data]) => {
      const sortedPolls = [...data.polls].sort((a, b) => 
        b.daysUntilElection - a.daysUntilElection // Sort by days until election (descending)
      );

      const color = colorPalette[year] || '#6b7280';
      
      // Add scatter plot for individual polls
      datasets.push({
        label: `${year} Polls`,
        data: sortedPolls.map(poll => ({
          x: poll.daysUntilElection,
          y: poll.mdgPercentage,
          pollDate: poll.date,
          pollster: poll.pollster,
          electionYear: year,
        })),
        backgroundColor: color,
        borderColor: color,
        pointRadius: isMobile ? 0 : 4, // Hide points on mobile
        pointHoverRadius: isMobile ? 0 : 6,
        showLine: false,
        type: 'scatter' as const,
        order: 2,
        hidden: isMobile // Hide individual polls on mobile
      });
      
      // Add rolling average line
      const rollingAverage = calculateRollingAverage(sortedPolls, 14); // 14-day window for longer timeline
      if (rollingAverage.length > 0) {
        datasets.push({
          label: `${year} 14-day Average`,
          data: rollingAverage,
          backgroundColor: 'transparent',
          borderColor: color,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 4,
          showLine: true,
          type: 'line' as const,
          tension: 0.4,
          order: 1
        });
      }
    });

  // Create x-axis labels (days until election)
  const allDays = datasets.flatMap(dataset => dataset.data.map((point: any) => point.x));
  const maxDays = Math.max(...allDays);
  const minDays = Math.min(...allDays);
  
  // Create tick marks for major intervals
  const xAxisTicks = [];
  for (let days = Math.ceil(maxDays / 100) * 100; days >= 0; days -= 100) {
    if (days <= maxDays) {
      xAxisTicks.push(days);
    }
  }

  const chartData = {
    datasets: datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: isMobile ? 'bottom' as const : 'top' as const,
        align: 'center' as const,
        labels: {
          font: {
            size: isMobile ? 10 : 14,
            weight: 'bold' as const,
          },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: isMobile ? 8 : 20,
          boxWidth: isMobile ? 15 : 20,
          // Filter out individual poll datasets on mobile
          filter: function(legendItem: any, chartData: any) {
            if (isMobile) {
              // Only show averages on mobile, hide individual polls
              return legendItem.text.includes('Average');
            }
            return true;
          }
        },
      },
              title: {
        display: true,
        text: 'MDG Polling Trends - All Elections with Rolling Averages',
        font: {
          size: 18,
          weight: 'bold' as const,
        },
        padding: 20,
      },
      tooltip: {
        callbacks: {
          title: (context: any) => {
            const point = context[0];
            if (point.dataset.label.includes('Average')) {
              return `${Math.abs(point.parsed.x)} days before election`;
            } else {
              const pollData = point.raw;
              return `${pollData.electionYear} Election - ${Math.abs(point.parsed.x)} days before`;
            }
          },
          label: (context: any) => {
            const dataset = context.dataset;
            
            if (dataset.label.includes('Average')) {
              return `14-day average: ${context.parsed.y.toFixed(1)}%`;
            } else {
              const point = context.raw;
              return [
                `MDG: ${point.y}%`,
                `Poll Date: ${new Date(point.pollDate).toLocaleDateString('en-GB')}`,
                `Pollster: ${point.pollster}`,
              ];
            }
          },
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#22c55e',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        title: {
          display: true,
          text: 'Days Until Election',
          font: {
            size: 16,
            weight: 'bold' as const,
          },
        },
        min: 0,
        max: maxDays + 50,
        reverse: true, // Show election day (0) on the right
        ticks: {
          stepSize: 100,
          font: {
            size: 12,
          },
          callback: function(value: any) {
            const numValue = Number(value);
            if (numValue === 0) return 'Election Day';
            if (numValue % 100 === 0) return `${numValue} days`;
            return '';
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'MDG Polling Percentage (%)',
          font: {
            size: 16,
            weight: 'bold' as const,
          },
        },
        min: 0,
        max: Math.max(12, Math.ceil(Math.max(...datasets.flatMap(d => d.data.map((p: any) => p.y))) / 2) * 2),
        ticks: {
          font: {
            size: 12,
          },
          callback: function(value: any) {
            return value + '%';
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'point' as const,
    },
  };

  // Calculate summary statistics (only from poll datasets, not averages)
  const pollDatasets = datasets.filter(d => d.label.includes('Polls'));
  const totalPolls = pollDatasets.reduce((sum, dataset) => sum + dataset.data.length, 0);
  const avgByElection = pollDatasets.map(dataset => {
    const year = dataset.label.replace(' Polls', '');
    const electionInfo = electionData.elections[year];
    
    // Calculate 7-day and 30-day averages before election
    const pollsLast7Days = dataset.data.filter((poll: any) => poll.x >= 0 && poll.x <= 7);
    const pollsLast30Days = dataset.data.filter((poll: any) => poll.x >= 0 && poll.x <= 30);
    
    const avg7Day = pollsLast7Days.length > 0 ? 
      (pollsLast7Days.reduce((sum: number, poll: any) => sum + poll.y, 0) / pollsLast7Days.length).toFixed(1) : 'N/A';
    
    const avg30Day = pollsLast30Days.length > 0 ? 
      (pollsLast30Days.reduce((sum: number, poll: any) => sum + poll.y, 0) / pollsLast30Days.length).toFixed(1) : 'N/A';
    
    return {
      year,
      count: dataset.data.length,
      peak: Math.max(...dataset.data.map((p: any) => p.y)).toFixed(1),
      avg7Day,
      avg30Day,
      pollsLast7DaysCount: pollsLast7Days.length,
      pollsLast30DaysCount: pollsLast30Days.length,
      actualResult: electionInfo?.actualResult ? electionInfo.actualResult.toFixed(1) : 'N/A',
      pollError7Day: electionInfo?.actualResult && avg7Day !== 'N/A' ? 
        (electionInfo.actualResult - parseFloat(avg7Day)).toFixed(1) : 'N/A',
      pollError30Day: electionInfo?.actualResult && avg30Day !== 'N/A' ? 
        (electionInfo.actualResult - parseFloat(avg30Day)).toFixed(1) : 'N/A'
    };
  });

  // Calculate pollster analysis - average error by polling company for each cycle
  const pollsterAnalysis: { [year: string]: { [pollster: string]: { error: number; count: number; polls: any[]; error50Days: number; count50Days: number } } } = {};
  
  Object.entries(electionData.elections).forEach(([year, electionInfo]) => {
    if (!electionInfo.actualResult) return; // Skip if no actual result
    
    pollsterAnalysis[year] = {};
    
    // Group polls by pollster for this election
    electionInfo.polls.forEach(poll => {
      // Extract main pollster name (first word after the " - ")
      const pollsterParts = poll.pollster.split(' - ');
      const pollsterName = pollsterParts.length > 1 ? 
        pollsterParts[1].split(' ')[0].trim() : 
        poll.pollster.split(' ')[0].trim();
      
      if (!pollsterAnalysis[year][pollsterName]) {
        pollsterAnalysis[year][pollsterName] = { 
          error: 0, 
          count: 0, 
          polls: [], 
          error50Days: 0, 
          count50Days: 0 
        };
      }
      
      const error = poll.mdgPercentage - (electionInfo.actualResult || 0);
      pollsterAnalysis[year][pollsterName].polls.push({ ...poll, error });
      pollsterAnalysis[year][pollsterName].error += error;
      pollsterAnalysis[year][pollsterName].count += 1;
      
      // Also track polls in the last 50 days
      if (poll.daysUntilElection >= 0 && poll.daysUntilElection <= 50) {
        pollsterAnalysis[year][pollsterName].error50Days += error;
        pollsterAnalysis[year][pollsterName].count50Days += 1;
      }
    });
    
    // Calculate average errors for each pollster
    Object.keys(pollsterAnalysis[year]).forEach(pollster => {
      const data = pollsterAnalysis[year][pollster];
      data.error = data.error / data.count;
      data.error50Days = data.count50Days > 0 ? data.error50Days / data.count50Days : data.error;
    });
  });

  // Calculate MDG change from June baseline to final 50 days for each cycle
  const mdgChangeAnalysis = Object.entries(electionData.elections).map(([year, electionInfo]) => {
    // Calculate June average
    const electionDate = new Date(electionInfo.electionDate);
    const juneStart = new Date(electionDate.getFullYear(), 5, 1); // June 1st
    const juneEnd = new Date(electionDate.getFullYear(), 5, 30); // June 30th
    
    const junePolls = electionInfo.polls.filter(poll => {
      const pollDate = new Date(poll.date);
      return pollDate >= juneStart && pollDate <= juneEnd;
    });
    
    const juneAverage = junePolls.length > 0 ? 
      junePolls.reduce((sum, poll) => sum + poll.mdgPercentage, 0) / junePolls.length : 
      null;

    // Calculate final 50-day average
    const final50DayPolls = electionInfo.polls.filter(poll => 
      poll.daysUntilElection >= 0 && poll.daysUntilElection <= 50
    );
    
    const final50DayAverage = final50DayPolls.length > 0 ? 
      final50DayPolls.reduce((sum, poll) => sum + poll.mdgPercentage, 0) / final50DayPolls.length : 
      null;

    const change = (juneAverage !== null && final50DayAverage !== null) ? 
      final50DayAverage - juneAverage : null;

    const actualResult = electionInfo.actualResult || null;
    const juneToActualChange = (juneAverage !== null && actualResult !== null) ? 
      actualResult - juneAverage : null;

    return {
      year,
      juneAverage,
      final50DayAverage,
      change,
      actualResult,
      juneToActualChange,
      juneCount: junePolls.length,
      final50DayCount: final50DayPolls.length
    };
  }).filter(item => item.change !== null);

  return (
    <div className="unified-timeline-chart">
      <div className="chart-container">
        <Chart type="scatter" data={chartData} options={options} />
      </div>
      
      <div className="chart-analysis">
        <h3>Election Cycle Analysis</h3>
        <div className="analysis-grid">
          {avgByElection.map(election => (
            <div key={election.year} className="election-stats">
              <h4>{election.year}</h4>
              <div className="stats-row">
                <span className="stat-label">Polls:</span>
                <span className="stat-value">{election.count}</span>
              </div>
              <div className="stats-row">
                <span className="stat-label">Peak:</span>
                <span className="stat-value">{election.peak}%</span>
              </div>
              <div className="stats-row">
                <span className="stat-label">Final 7 Days:</span>
                <span className="stat-value">
                  {election.avg7Day}% {election.avg7Day !== 'N/A' && `(${election.pollsLast7DaysCount})`}
                </span>
              </div>
              <div className="stats-row">
                <span className="stat-label">Final 30 Days:</span>
                <span className="stat-value">
                  {election.avg30Day}% {election.avg30Day !== 'N/A' && `(${election.pollsLast30DaysCount})`}
                </span>
              </div>
              <div className="stats-row">
                <span className="stat-label">Actual Result:</span>
                <span className="stat-value" style={{fontWeight: 'bold', color: election.actualResult !== 'N/A' ? '#22c55e' : 'inherit'}}>
                  {election.actualResult}%
                </span>
              </div>
              {election.pollError7Day !== 'N/A' && (
                <div className="stats-row">
                  <span className="stat-label">7-Day Error:</span>
                  <span className="stat-value" style={{color: parseFloat(election.pollError7Day) < 0 ? '#ef4444' : '#22c55e'}}>
                    {parseFloat(election.pollError7Day) > 0 ? '+' : ''}{election.pollError7Day}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="pollster-analysis">
          <h3>Pollster Analysis</h3>
          <p className="analysis-description">
            Final 50-day polling error vs actual results. Red = overestimated, Green = underestimated.
          </p>
          <div className="pollster-grid">
            {Object.entries(pollsterAnalysis).map(([year, pollsters]) => (
              <div key={year} className="pollster-year">
                <h4>{year}</h4>
                <div className="pollster-stats">
                  {Object.entries(pollsters)
                    .filter(([, data]) => data.count50Days >= 2) // Only show pollsters with 2+ polls in last 50 days
                    .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically by pollster name
                    .map(([pollster, data]) => (
                      <div key={pollster} className="pollster-row">
                        <span className="pollster-name">{pollster}</span>
                        <span className="pollster-error" style={{
                          color: data.error50Days > 0 ? '#ef4444' : '#22c55e'
                        }}>
                          {data.error50Days > 0 ? '+' : ''}{data.error50Days.toFixed(1)}%
                        </span>
                        <span className="pollster-count">({data.count50Days} polls)</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mdg-change-analysis">
          <h3>MDG Polling Change Analysis</h3>
          <p className="analysis-description">Campaign momentum from June to election day</p>
          <div className="change-table">
            <div className="table-header">
              <span>Election</span>
              <span>June Baseline</span>
              <span>Final 50 Days</span>
              <span>Actual Result</span>
              <span>June→Final</span>
              <span>June→Actual</span>
            </div>
            {mdgChangeAnalysis.map(item => (
              <div key={item.year} className="table-row">
                <span className="election-year">{item.year}</span>
                <span className="baseline-value">
                  {item.juneAverage?.toFixed(1)}% ({item.juneCount})
                </span>
                <span className="final-value">
                  {item.final50DayAverage?.toFixed(1)}% ({item.final50DayCount})
                </span>
                <span className="actual-result" style={{
                  fontWeight: 'bold',
                  color: item.actualResult !== null ? '#1f2937' : '#6b7280'
                }}>
                  {item.actualResult?.toFixed(1)}%
                </span>
                <span className="change-value" style={{
                  color: (item.change || 0) > 0 ? '#22c55e' : '#ef4444',
                  fontWeight: 'bold'
                }}>
                  {(item.change || 0) > 0 ? '+' : ''}{item.change?.toFixed(1)}%
                </span>
                <span className="june-actual-change" style={{
                  color: (item.juneToActualChange || 0) > 0 ? '#22c55e' : '#ef4444',
                  fontWeight: 'bold'
                }}>
                  {item.juneToActualChange !== null ? 
                    `${(item.juneToActualChange || 0) > 0 ? '+' : ''}${item.juneToActualChange?.toFixed(1)}%` : 
                    'N/A'
                  }
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default UnifiedTimelineChart;


