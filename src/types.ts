export interface Poll {
  date: string;
  mdgPercentage: number;
  pollster: string;
  daysUntilElection: number;
  rssTitle?: string; // Optional since historical data might not have this
  url: string;
  scope?: 'national' | 'regional' | 'unknown'; // Geographic scope of the poll (optional during migration)
  region?: string; // Specific region if regional poll
}

export interface Election {
  electionDate: string;
  polls: Poll[];
  actualResult?: number; // MDG's actual election result percentage
}

export interface ElectionData {
  elections: {
    [year: string]: Election;
  };
}
