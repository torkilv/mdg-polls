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
  ScatterController,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { ElectionData } from '../types';
import { calculateRollingAverage, AveragePoint } from '../utils/rollingAverage';
import { useIsMobile } from '../hooks/useIsMobile';
import './ShortTimelineChart.css';

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

interface ShortTimelineChartProps {
  data: ElectionData;
}

interface PollPoint {
  x: number;
  y: number;
  pollster: string;
  date: string;
  year: string;
}

const ShortTimelineChart: React.FC<ShortTimelineChartProps> = ({ data }) => {
  const isMobile = useIsMobile();
  
  // Color palette for different election years
  const colorPalette = {
    '2013': '#FF6384',
    '2017': '#36A2EB', 
    '2021': '#FFCE56',
    '2025': '#4BC0C0'
  };

  // Process data for the chart (50 days before election)
  const processedData = Object.entries(data.elections).map(([year, election]) => {
    // Filter polls to only include those within 50 days of election
    // daysUntilElection is positive (e.g., 50 means 50 days until election)
    const recentPolls = election.polls.filter(poll => 
      poll.daysUntilElection >= 0 && poll.daysUntilElection <= 50
    );

    // Calculate June average (polls from June of election year)
    const electionDate = new Date(election.electionDate);
    const juneStart = new Date(electionDate.getFullYear(), 5, 1); // June 1st
    const juneEnd = new Date(electionDate.getFullYear(), 5, 30); // June 30th
    
    const junePolls = election.polls.filter(poll => {
      const pollDate = new Date(poll.date);
      return pollDate >= juneStart && pollDate <= juneEnd;
    });
    
    const juneAverage = junePolls.length > 0 ? 
      junePolls.reduce((sum, poll) => sum + poll.mdgPercentage, 0) / junePolls.length : 
      null;

    const pollPoints: PollPoint[] = recentPolls.map(poll => ({
      x: poll.daysUntilElection,
      y: poll.mdgPercentage,
      pollster: poll.pollster.replace('pollofpolls.no - ', ''),
      date: poll.date,
      year: year
    }));

    const rollingAverage = calculateRollingAverage(recentPolls);

    return {
      year,
      pollPoints,
      rollingAverage,
      juneAverage,
      color: colorPalette[year as keyof typeof colorPalette] || '#999999'
    };
  }).filter(item => item.pollPoints.length > 0);

  // Create datasets for Chart.js
  const datasets: any[] = [];

  // Add individual poll datasets (scatter plots) - now hidden on all devices
  processedData.forEach(({ year, pollPoints, color }) => {
    datasets.push({
      label: `${year}`,
      data: pollPoints,
      backgroundColor: color,
      borderColor: color,
      pointRadius: 0, // Hide points on all devices
      pointHoverRadius: 0,
      showLine: false,
      type: 'scatter' as const,
      order: 2,
      hidden: true // Hide the entire dataset on all devices
    });
  });

  // Add rolling average datasets (line charts)
  processedData.forEach(({ year, rollingAverage, color }) => {
    if (rollingAverage.length > 0) {
      datasets.push({
        label: `${year} Avg`,
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

  // Add June baseline datasets (flat lines)
  processedData.forEach(({ year, juneAverage, color }) => {
    if (juneAverage !== null) {
      datasets.push({
        label: `${year} June`,
        data: [
          { x: 50, y: juneAverage },
          { x: 0, y: juneAverage }
        ],
        backgroundColor: 'transparent',
        borderColor: color,
        borderWidth: 2,
        borderDash: [5, 5], // Dashed line
        pointRadius: 0,
        pointHoverRadius: 0,
        showLine: true,
        type: 'line' as const,
        order: 0, // Behind everything else
        tension: 0
      });
    }
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: false
      },
      legend: {
        display: true,
        position: 'top' as const,
        align: 'center' as const,
        labels: {
          usePointStyle: true,
          padding: isMobile ? 8 : 15,
          boxWidth: isMobile ? 15 : 20,
          font: {
            size: isMobile ? 11 : 12
          },
          // Filter out individual poll datasets on all devices
          filter: function(legendItem: any, chartData: any) {
            // Only show averages and June baselines, hide individual polls
            return legendItem.text.includes('Avg') || legendItem.text.includes('June');
          }
        }
      },
      tooltip: {
        callbacks: {
          title: (context: any) => {
            const point = context[0];
            if (point.dataset.label.includes('Average')) {
              return `${point.parsed.x} days before election`;
            } else {
              const pollData = point.raw as PollPoint;
              return `${pollData.date} (${point.parsed.x} days before)`;
            }
          },
          label: (context: any) => {
            const point = context.datasetIndex;
            const dataset = datasets[point];
            
            if (dataset.label.includes('Average')) {
              return `7-day average: ${context.parsed.y.toFixed(1)}%`;
            } else {
              const pollData = context.raw as PollPoint;
              return [
                `MDG: ${context.parsed.y}%`,
                `Pollster: ${pollData.pollster}`
              ];
            }
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: {
          display: true,
          text: 'Days Until Election'
        },
        min: 0,
        max: 50,
        reverse: true, // Show election day (0) on the right
        ticks: {
          callback: (value: any) => {
            if (value === 0) return 'Election Day';
            return `${value} days`;
          },
          stepSize: 10
        },
        grid: {
          color: 'rgba(0,0,0,0.1)'
        }
      },
      y: {
        title: {
          display: true,
          text: 'MDG Support (%)'
        },
        min: 0,
        max: 8,
        ticks: {
          callback: (value: any) => `${value}%`,
          stepSize: 1
        },
        grid: {
          color: 'rgba(0,0,0,0.1)'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'point' as const
    }
  };

  const chartData = {
    datasets
  };

  return (
    <div className="short-timeline-chart">
      <div className="chart-container">
        <Chart type="scatter" data={chartData} options={chartOptions} />
      </div>
      <div className="chart-info">
        <p>
          Shows individual polls as dots and 7-day rolling averages as lines for the final 100 days before each election.
          The rolling average smooths out daily fluctuations to reveal underlying trends.
        </p>
      </div>
    </div>
  );
};

export default ShortTimelineChart;
