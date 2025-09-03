# MDG Election Polling Comparison Website - System Architecture Plan

## Project Overview
A React-based website that displays MDG's polling performance in the 24 months leading up to each Norwegian parliamentary election since 2011, using data from pollofpolls.no RSS feed.

## System Architecture

### 1. Data Layer Architecture

#### Data Poller Service
- **Technology**: Node.js script or GitHub Actions workflow
- **Frequency**: Every 2 hours
- **Function**: Fetch RSS feed, parse XML, extract MDG data, update JSON data files

#### Data Storage Strategy
- **Format**: Static JSON files stored in repository
- **Structure**: 
  ```json
  {
    "elections": {
      "2025": {
        "electionDate": "2025-09-13",
        "polls": [
          {
            "date": "2024-01-15",
            "mdgPercentage": 3.2,
            "pollster": "Norstat",
            "daysUntilElection": 607
          }
        ]
      }
    }
  }
  ```

### 2. Frontend Architecture

#### React Application Structure
- **Framework**: React 18 with functional components and hooks
- **Routing**: React Router (if multiple pages needed)
- **Styling**: CSS Modules or Styled Components
- **Charts**: Chart.js or D3.js for line graphs

#### Component Hierarchy
```
App
├── Header (title, description)
├── ElectionCycleSelector (if needed for navigation)
├── ElectionChart (main visualization component)
│   ├── LineGraph (polling trend line)
│   ├── DataPoints (individual poll markers)
│   └── Timeline (24-month countdown axis)
└── Footer (data source attribution)
```

### 3. Deployment Architecture

#### GitHub Pages Setup
- **Build Process**: GitHub Actions for automated builds
- **Static Hosting**: GitHub Pages from `gh-pages` branch
- **Domain**: `username.github.io/mdg-elections-compare`

## Detailed Implementation Plan

### Phase 1: Data Collection & Processing (Week 1)

#### Milestone 1.1: RSS Feed Analysis
**Tasks:**
1. Analyze pollofpolls.no RSS feed structure
2. Identify MDG data patterns in XML
3. Map historical election dates (2011, 2013, 2017, 2021, 2025)
4. Document data extraction requirements

#### Milestone 1.2: Data Poller Development
**Tasks:**
1. Create Node.js script to fetch and parse RSS feed
2. Implement MDG data extraction logic
3. Create data transformation to JSON format
4. Add 24-month filtering logic (based on election dates)
5. Implement file-based persistence in `/data` directory

#### Milestone 1.3: Historical Data Bootstrap
**Tasks:**
1. Research historical polling data availability
2. Create initial dataset for all election cycles since 2011
3. Validate data completeness and accuracy
4. Set up automated data updates via GitHub Actions

### Phase 2: Frontend Development (Week 2)

#### Milestone 2.1: React Application Setup
**Tasks:**
1. Initialize React application with Create React App
2. Set up project structure and component folders
3. Configure build process for GitHub Pages deployment
4. Install charting library (Chart.js recommended)

#### Milestone 2.2: Core Components Development
**Tasks:**
1. Create `ElectionChart` component with Chart.js integration
2. Implement line graph visualization for polling trends
3. Add data point markers for individual polls
4. Create responsive timeline axis (24 months countdown)
5. Style components with clean, professional design

#### Milestone 2.3: Data Integration
**Tasks:**
1. Create data loading service to fetch JSON files
2. Implement data processing for chart consumption
3. Add error handling for missing data
4. Create loading states and fallbacks

### Phase 3: Visualization & Polish (Week 3)

#### Milestone 3.1: Chart Enhancements
**Tasks:**
1. Fine-tune line graph appearance (colors, thickness, smoothing)
2. Add hover tooltips showing poll details
3. Implement election date markers on timeline
4. Add percentage scale and grid lines
5. Create legend and data source attribution

#### Milestone 3.2: Multi-Election Display
**Tasks:**
1. Create layout for multiple election cycles
2. Implement consistent 24-month timeline for each election
3. Add election cycle headers with dates
4. Ensure responsive design for mobile devices

### Phase 4: Automation & Deployment (Week 4)

#### Milestone 4.1: GitHub Actions Setup
**Tasks:**
1. Create workflow for data polling every 2 hours
2. Set up automatic data commit and push
3. Configure build and deployment to GitHub Pages
4. Add error notifications for failed data updates

#### Milestone 4.2: Final Testing & Launch
**Tasks:**
1. Test data update pipeline end-to-end
2. Validate historical data accuracy
3. Perform cross-browser testing
4. Deploy to GitHub Pages
5. Monitor initial data collection cycle

## Technical Specifications

### Data Poller Requirements
- **Language**: Node.js with axios for HTTP requests
- **XML Parsing**: xml2js or fast-xml-parser
- **Schedule**: GitHub Actions cron job (`0 */2 * * *`)
- **Error Handling**: Retry logic and notification system

### Frontend Requirements
- **React Version**: 18+
- **Chart Library**: Chart.js with react-chartjs-2
- **Build Tool**: Create React App or Vite
- **CSS Approach**: CSS Modules for component styling
- **Browser Support**: Modern browsers (ES6+)

### Performance Considerations
- **Data Size**: Optimize JSON structure for minimal file size
- **Loading**: Implement lazy loading for large datasets
- **Caching**: Leverage browser caching for static JSON files
- **Bundle Size**: Code splitting if application grows

## File Structure
```
mdg-elections-compare/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── ElectionChart.js
│   │   ├── LineGraph.js
│   │   └── DataPoint.js
│   ├── services/
│   │   └── dataService.js
│   ├── styles/
│   │   └── components/
│   └── App.js
├── data/
│   └── polling-data.json
├── scripts/
│   └── poll-fetcher.js
├── .github/
│   └── workflows/
│       ├── data-update.yml
│       └── deploy.yml
└── package.json
```

## Success Metrics
1. **Data Accuracy**: 95%+ of available polls captured
2. **Update Reliability**: 99%+ successful data updates
3. **Performance**: Page load time under 3 seconds
4. **Availability**: 99%+ uptime on GitHub Pages

## Development Notes

### Election Dates Reference
- **2011**: September 12, 2011
- **2013**: September 9, 2013
- **2017**: September 11, 2017
- **2021**: September 13, 2021
- **2025**: September 8, 2025 (projected)

### Data Source
- **Primary**: pollofpolls.no RSS feed
- **Backup**: Manual data entry if RSS fails
- **Attribution**: Clear attribution to pollofpolls.no required

### Deployment Instructions
1. Fork repository
2. Enable GitHub Pages in repository settings
3. Configure GitHub Actions secrets if needed
4. Deploy automatically on push to main branch

---

*This architecture plan serves as the complete blueprint for developing the MDG election polling comparison website. Follow the phases and milestones sequentially for optimal development flow.*
