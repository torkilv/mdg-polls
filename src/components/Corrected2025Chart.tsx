import React from 'react';
import { Chart } from 'react-chartjs-2';
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
  ScatterController,
} from 'chart.js';
import { ElectionData } from '../types';
import { calculateRollingAverage } from '../utils/rollingAverage';
import './Corrected2025Chart.css';

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

interface Corrected2025ChartProps {
  electionData: ElectionData;
}

const Corrected2025Chart: React.FC<Corrected2025ChartProps> = ({ electionData }) => {
  // Calculate 2021 pollster errors (50-day average)
  const pollster2021Errors: { [pollster: string]: number } = {};
  
  const election2021 = electionData.elections['2021'];
  if (election2021 && election2021.actualResult) {
    const pollsterData: { [pollster: string]: { error: number; count: number } } = {};
    
    election2021.polls.forEach(poll => {
      if (poll.daysUntilElection >= 0 && poll.daysUntilElection <= 50) {
        // Extract pollster name
        const pollsterParts = poll.pollster.split(' - ');
        const pollsterName = pollsterParts.length > 1 ? 
          pollsterParts[1].split(' ')[0].trim() : 
          poll.pollster.split(' ')[0].trim();
        
        if (!pollsterData[pollsterName]) {
          pollsterData[pollsterName] = { error: 0, count: 0 };
        }
        
        const error = poll.mdgPercentage - (election2021.actualResult || 0);
        pollsterData[pollsterName].error += error;
        pollsterData[pollsterName].count += 1;
      }
    });
    
    // Calculate average errors
    Object.keys(pollsterData).forEach(pollster => {
      const data = pollsterData[pollster];
      if (data.count >= 2) { // Only use pollsters with 2+ polls
        pollster2021Errors[pollster] = data.error / data.count;
      }
    });
  }

  // Process 2025 data
  const election2025 = electionData.elections['2025'];
  if (!election2025) {
    return <div>No 2025 data available</div>;
  }

  // Filter to final 50 days and apply corrections
  const final50DayPolls = election2025.polls
    .filter(poll => poll.daysUntilElection >= 0 && poll.daysUntilElection <= 50)
    .map(poll => {
      // Extract pollster name
      const pollsterParts = poll.pollster.split(' - ');
      const pollsterName = pollsterParts.length > 1 ? 
        pollsterParts[1].split(' ')[0].trim() : 
        poll.pollster.split(' ')[0].trim();
      
      // Apply correction if we have 2021 error data for this pollster
      const correction = pollster2021Errors[pollsterName] || 0;
      const correctedPercentage = poll.mdgPercentage - correction;
      
      return {
        ...poll,
        originalPercentage: poll.mdgPercentage,
        correctedPercentage: Math.max(0, correctedPercentage), // Don't go below 0%
        pollsterName,
        correction
      };
    })
    .sort((a, b) => b.daysUntilElection - a.daysUntilElection);

  // Create datasets
  const datasets: any[] = [];

  // Original 2025 polls (scatter)
  datasets.push({
    label: '2025 Original Polls',
    data: final50DayPolls.map(poll => ({
      x: poll.daysUntilElection,
      y: poll.originalPercentage,
      pollster: poll.pollsterName,
      date: poll.date
    })),
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
    pointRadius: 4,
    pointHoverRadius: 6,
    showLine: false,
    type: 'scatter' as const,
    order: 3
  });

  // Corrected 2025 polls (scatter) - includes all polls, corrected and uncorrected
  datasets.push({
    label: '2025 Bias-Corrected Polls',
    data: final50DayPolls.map(poll => ({
      x: poll.daysUntilElection,
      y: poll.correctedPercentage,
      pollster: poll.pollsterName,
      date: poll.date,
      correction: poll.correction,
      wasCorrected: poll.correction !== 0
    })),
    backgroundColor: '#10b981',
    borderColor: '#10b981',
    pointRadius: 4,
    pointHoverRadius: 6,
    showLine: false,
    type: 'scatter' as const,
    order: 2
  });

  // Original 7-day rolling average
  const originalRollingAverage = calculateRollingAverage(
    final50DayPolls.map(poll => ({
      ...poll,
      mdgPercentage: poll.originalPercentage
    })),
    7
  );

  if (originalRollingAverage.length > 0) {
    datasets.push({
      label: '2025 Original 7-day Average',
      data: originalRollingAverage,
      backgroundColor: 'transparent',
      borderColor: '#3b82f6',
      borderWidth: 3,
      pointRadius: 0,
      pointHoverRadius: 4,
      showLine: true,
      type: 'line' as const,
      order: 1,
      tension: 0.2
    });
  }

  // Corrected 7-day rolling average
  const correctedRollingAverage = calculateRollingAverage(
    final50DayPolls.map(poll => ({
      ...poll,
      mdgPercentage: poll.correctedPercentage
    })),
    7
  );

  if (correctedRollingAverage.length > 0) {
    datasets.push({
      label: '2025 Corrected 7-day Average',
      data: correctedRollingAverage,
      backgroundColor: 'transparent',
      borderColor: '#10b981',
      borderWidth: 3,
      pointRadius: 0,
      pointHoverRadius: 4,
      showLine: true,
      type: 'line' as const,
      order: 0,
      tension: 0.2
    });
  }

  const chartData = {
    datasets: datasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: '2025 MDG Polling: Original vs Bias-Corrected (Final 50 Days)',
        font: {
          size: 18,
          weight: 'bold' as const
        }
      },
      legend: {
        display: true,
        position: 'top' as const
      },
      tooltip: {
        callbacks: {
          title: (context: any) => {
            const point = context[0];
            return `${point.parsed.x} days until election`;
          },
          label: (context: any) => {
            const point = context.raw;
            let label = `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
            if (point.pollster) {
              label += ` (${point.pollster})`;
            }
            if (point.correction && point.correction !== 0) {
              label += ` [Corrected by ${point.correction > 0 ? '-' : '+'}${Math.abs(point.correction).toFixed(1)}%]`;
            } else if (point.wasCorrected === false) {
              label += ` [No 2021 data - uncorrected]`;
            }
            if (point.date) {
              label += ` - ${point.date}`;
            }
            return label;
          }
        }
      }
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
            weight: 'bold' as const
          }
        },
        min: 0,
        max: 50,
        reverse: true,
        ticks: {
          stepSize: 10,
          font: {
            size: 12
          },
          callback: function(value: any) {
            const numValue = Number(value);
            if (numValue === 0) return 'Election Day';
            if (numValue % 10 === 0) return `${numValue} days`;
            return '';
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'MDG Polling Percentage (%)',
          font: {
            size: 16,
            weight: 'bold' as const
          }
        },
        min: 0,
        max: 8,
        ticks: {
          font: {
            size: 12
          },
          callback: function(value: any) {
            return `${value}%`;
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  };

  // Calculate statistics
  const correctedPollsWithData = final50DayPolls.filter(poll => poll.correction !== 0);
  const uncorrectedPolls = final50DayPolls.filter(poll => poll.correction === 0);
  const avgCorrection = correctedPollsWithData.length > 0 ? 
    correctedPollsWithData.reduce((sum, poll) => sum + Math.abs(poll.correction), 0) / correctedPollsWithData.length : 0;

  const finalOriginalAvg = originalRollingAverage.length > 0 ? 
    originalRollingAverage[originalRollingAverage.length - 1].y : null;
  
  const finalCorrectedAvg = correctedRollingAverage.length > 0 ? 
    correctedRollingAverage[correctedRollingAverage.length - 1].y : null;

  return (
    <div className="corrected-2025-chart">
      <div className="chart-container">
        <Chart type="scatter" data={chartData} options={options} />
      </div>
      
      <div className="correction-analysis">
        <h3>Bias Correction Analysis</h3>
        <div className="analysis-grid">
          <div className="stat-box">
            <h4>Methodology</h4>
            <p>Applies each pollster's 2021 systematic error to their 2025 polls. 
               Positive 2021 errors (overestimation) are subtracted from 2025 results.</p>
          </div>
          
          <div className="stat-box">
            <h4>Corrections Applied</h4>
            <p>{correctedPollsWithData.length} polls corrected using 2021 bias</p>
            <p>{uncorrectedPolls.length} polls uncorrected (no 2021 data)</p>
            <p>Average correction magnitude: {avgCorrection.toFixed(1)} percentage points</p>
          </div>
          
          {finalOriginalAvg !== null && finalCorrectedAvg !== null && (
            <div className="stat-box">
              <h4>Final Averages</h4>
              <p>Original 7-day: <strong>{finalOriginalAvg.toFixed(1)}%</strong></p>
              <p>Corrected 7-day: <strong style={{color: '#10b981'}}>{finalCorrectedAvg.toFixed(1)}%</strong></p>
              <p>Net adjustment: <strong>{(finalCorrectedAvg - finalOriginalAvg).toFixed(1)} points</strong></p>
            </div>
          )}
        </div>
        
        <div className="pollster-corrections">
          <h4>2021 Bias Used for Corrections</h4>
          <div className="corrections-list">
            {Object.entries(pollster2021Errors)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([pollster, error]) => (
                <div key={pollster} className="correction-item">
                  <span className="pollster-name">{pollster}</span>
                  <span className="error-value" style={{
                    color: error > 0 ? '#ef4444' : '#22c55e'
                  }}>
                    {error > 0 ? '+' : ''}{error.toFixed(1)}% bias in 2021
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Corrected2025Chart;
