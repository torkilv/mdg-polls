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
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Chart } from 'react-chartjs-2';
import { Election } from '../types';
import { calculateRollingAverage } from '../utils/rollingAverage';
import { useIsMobile } from '../hooks/useIsMobile';
import './ElectionChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  TimeScale
);

interface ElectionChartProps {
  electionYear: number;
  electionData: Election;
}

const ElectionChart: React.FC<ElectionChartProps> = ({ electionYear, electionData }) => {
  const isMobile = useIsMobile();

  // Sort polls by date
  const sortedPolls = [...electionData.polls].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate rolling average using daysUntilElection for consistency
  const rollingAverage = calculateRollingAverage(sortedPolls, 10); // 10-day window

  // Prepare chart data with both polls and rolling average
  const datasets: any[] = [
    // Individual polls as scatter points - now hidden on all devices
    {
      label: 'Individual Polls',
      data: sortedPolls.map(poll => ({
        x: new Date(poll.date).getTime(),
        y: poll.mdgPercentage,
        pollster: poll.pollster,
        date: poll.date,
        daysUntil: poll.daysUntilElection
      })),
      backgroundColor: '#22c55e',
      borderColor: '#22c55e',
      pointRadius: 0, // Hide points on all devices
      pointHoverRadius: 0,
      showLine: false,
      type: 'scatter' as const,
      order: 2,
      hidden: true // Hide individual polls on all devices
    }
  ];

  // Add rolling average line if we have enough data
  if (rollingAverage.length > 0) {
    // Convert rolling average back to date format for this chart
    const averageWithDates = rollingAverage.map(point => {
      // Find the closest poll to this daysUntilElection value
      const closestPoll = sortedPolls.reduce((prev, curr) => 
        Math.abs(curr.daysUntilElection - point.x) < Math.abs(prev.daysUntilElection - point.x) ? curr : prev
      );
      return {
        x: new Date(closestPoll.date).getTime(),
        y: point.y
      };
    });

    datasets.push({
      label: '10-day Rolling Average',
      data: averageWithDates,
      backgroundColor: 'transparent',
      borderColor: '#16a34a', // Darker green
      borderWidth: 3,
      pointRadius: 0,
      pointHoverRadius: 4,
      showLine: true,
      type: 'line' as const,
      tension: 0.4,
      order: 1
    });
  }

  const chartData = {
    datasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'center' as const,
        labels: {
          font: {
            size: isMobile ? 10 : 14,
            weight: 'bold' as const,
          },
          padding: isMobile ? 8 : 20,
          boxWidth: isMobile ? 15 : 20,
          // Filter out individual poll datasets on all devices
          filter: function(legendItem: any, chartData: any) {
            // Only show averages, hide individual polls
            return legendItem.text.includes('Average');
          }
        },
      },
      title: {
        display: true,
        text: `MDG Polling Trend with Rolling Average - ${electionYear} Election`,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: 20,
      },
      tooltip: {
        callbacks: {
          title: (context: any) => {
            const point = context[0];
            if (point.dataset.label.includes('Average')) {
              return `10-day Rolling Average`;
            } else {
              const pollData = point.raw;
              return `${pollData.pollster}`;
            }
          },
          label: (context: any) => {
            const dataset = context.dataset;
            
            if (dataset.label.includes('Average')) {
              return `10-day average: ${context.parsed.y.toFixed(1)}%`;
            } else {
              const poll = context.raw;
              return [
                `MDG: ${poll.y}%`,
                `Date: ${new Date(poll.date).toLocaleDateString('en-GB')}`,
                `Days until election: ${poll.daysUntil}`,
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
        displayColors: false,
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'month' as const,
        },
        display: true,
        title: {
          display: true,
          text: 'Date',
          font: {
            size: 14,
            weight: 'bold' as const,
          },
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: {
            size: 12,
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
          text: 'Polling Percentage (%)',
          font: {
            size: 14,
            weight: 'bold' as const,
          },
        },
        min: 0,
        max: Math.max(10, Math.ceil(Math.max(...sortedPolls.map(p => p.mdgPercentage)) / 2) * 2),
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

  if (sortedPolls.length === 0) {
    return (
      <div className="election-chart">
        <div className="no-data">
          No polling data available for the {electionYear} election cycle.
        </div>
      </div>
    );
  }

  return (
    <div className="election-chart">
      <div className="chart-container">
        <Chart type="scatter" data={chartData} options={options} />
      </div>
      <div className="chart-summary">
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-label">Total Polls:</span>
            <span className="stat-value">{sortedPolls.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Latest Poll:</span>
            <span className="stat-value">{sortedPolls[sortedPolls.length - 1]?.mdgPercentage}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">Average:</span>
            <span className="stat-value">
              {(sortedPolls.reduce((sum, poll) => sum + poll.mdgPercentage, 0) / sortedPolls.length).toFixed(1)}%
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Range:</span>
            <span className="stat-value">
              {Math.min(...sortedPolls.map(p => p.mdgPercentage))}% - {Math.max(...sortedPolls.map(p => p.mdgPercentage))}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectionChart;
