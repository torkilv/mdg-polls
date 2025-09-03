export interface AveragePoint {
  x: number;
  y: number;
}

export const calculateRollingAverage = (polls: any[], windowDays: number = 7): AveragePoint[] => {
  if (polls.length < 2) return [];
  
  // Sort polls by daysUntilElection (ascending, so -100 comes before -90)
  const sortedPolls = [...polls].sort((a, b) => a.daysUntilElection - b.daysUntilElection);
  const averages: AveragePoint[] = [];
  
  // Create average points every few days to ensure smooth lines
  const minDays = Math.min(...sortedPolls.map(p => p.daysUntilElection));
  const maxDays = Math.max(...sortedPolls.map(p => p.daysUntilElection));
  
  const step = Math.max(3, Math.floor((maxDays - minDays) / 100)); // Adaptive step size
  
  for (let day = minDays; day <= maxDays; day += step) {
    const windowStart = day - windowDays/2;
    const windowEnd = day + windowDays/2;
    
    // Find all polls within the window
    const pollsInWindow = sortedPolls.filter(poll => 
      poll.daysUntilElection >= windowStart && poll.daysUntilElection <= windowEnd
    );
    
    if (pollsInWindow.length > 0) {
      const average = pollsInWindow.reduce((sum, poll) => sum + poll.mdgPercentage, 0) / pollsInWindow.length;
      averages.push({
        x: day,
        y: average
      });
    }
  }
  
  return averages;
};
