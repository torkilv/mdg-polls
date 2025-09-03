# MDG Election Polling Comparison

A React-based website that displays MDG's polling performance in the 24 months leading up to each Norwegian parliamentary election since 2011, using data from pollofpolls.no.

## 🚀 Live Demo

Visit the live website: [https://torkilvederhus.github.io/mdg-elections-compare](https://torkilvederhus.github.io/mdg-elections-compare)

## 🔄 Updating Poll Data

To keep the polling data current, use the incremental update system:

```bash
# Update with latest polls (recommended for regular updates)
npm run update-polls

# Or run the individual steps
node scripts/update-polls.js  # Fetch new polls
npm run sync-data            # Sync to app directories
```

The update script automatically:
- Finds the highest poll ID in your current data
- Checks pollofpolls.no for newer polls with MDG data
- Adds only new polls to avoid duplicates
- Properly classifies polls as national/regional
- Syncs the updated data to your app

## 📊 Features

- **Real-time Data**: Automatically fetches and updates polling data every 2 hours from pollofpolls.no
- **Interactive Charts**: Beautiful line graphs showing MDG's polling trends with Chart.js
- **24-Month Timeline**: Shows polling data for the 24 months leading up to each election
- **National Polls Only**: Focuses on national parliamentary election polls ("hele landet")
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Historical Data**: Tracks elections from 2011 onwards

## 🛠 Technology Stack

- **Frontend**: React 18 with TypeScript
- **Charts**: Chart.js with react-chartjs-2
- **Data Fetching**: Node.js with axios and cheerio
- **RSS Parsing**: rss-parser
- **Deployment**: GitHub Pages
- **Automation**: GitHub Actions

## 📁 Project Structure

```
mdg-elections-compare/
├── public/                 # Static files served by React
│   ├── data/              # Polling data JSON files
│   ├── index.html         # Main HTML template
│   └── manifest.json      # PWA manifest
├── src/                   # React source code
│   ├── components/        # React components
│   │   ├── ElectionChart.tsx
│   │   └── ElectionChart.css
│   ├── App.tsx           # Main App component
│   ├── App.css           # App styles
│   ├── types.ts          # TypeScript type definitions
│   └── index.tsx         # React entry point
├── scripts/               # Data fetching scripts
│   └── poll-fetcher.js   # RSS feed parser and data processor
├── data/                 # Raw polling data storage
│   └── polling-data.json # Processed polling data
├── .github/workflows/    # GitHub Actions
│   ├── data-update.yml   # Automated data fetching
│   └── deploy.yml        # Deployment to GitHub Pages
└── ARCHITECTURE_PLAN.md  # Detailed system architecture
```

## 🔄 Data Pipeline

1. **RSS Feed Fetching**: Every 2 hours, GitHub Actions runs the poll fetcher
2. **Data Processing**: Extracts MDG percentages from individual poll pages
3. **Data Filtering**: Keeps only national parliamentary election polls within 24 months of elections
4. **Storage**: Updates JSON files in both `data/` and `public/data/` directories
5. **Deployment**: Automatically rebuilds and deploys the website when data changes

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/torkilvederhus/mdg-elections-compare.git
   cd mdg-elections-compare
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Fetch initial polling data:
   ```bash
   npm run fetch-data
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm run fetch-data` - Manually fetch and update recent polling data
- `npm run fetch-historical` - Fetch historical polling data (comprehensive but slow)
- `npm run create-sample-data` - Create sample historical data for demonstration
- `npm run deploy` - Deploy to GitHub Pages (requires gh-pages setup)

## 📊 Data Source

All polling data is sourced from [pollofpolls.no](https://www.pollofpolls.no), a comprehensive Norwegian polling aggregator. The data includes:

- Poll date and pollster information
- MDG percentage for each poll
- Days until election calculation
- Links to original poll details

### Historical Data Collection

The application includes two data fetching strategies:

1. **Recent Data (`npm run fetch-data`)**: Fast RSS-based fetching for current polls
2. **Historical Data (`npm run fetch-historical`)**: Comprehensive archive scanning for past elections
3. **Sample Data (`npm run create-sample-data`)**: Creates realistic sample data for demonstration

**Note**: Historical data fetching is resource-intensive and should be used sparingly to respect the source website.

### Election Dates Reference

- **2011**: September 12, 2011
- **2013**: September 9, 2013  
- **2017**: September 11, 2017
- **2021**: September 13, 2021
- **2025**: September 8, 2025 (projected)

## 🔧 Configuration

### GitHub Pages Deployment

1. Enable GitHub Pages in repository settings
2. Set source to "GitHub Actions"
3. The deployment workflow will automatically build and deploy on push to main

### Data Update Frequency

The polling data is updated every 2 hours via GitHub Actions. To modify the frequency, edit the cron schedule in `.github/workflows/data-update.yml`:

```yaml
schedule:
  - cron: '0 */2 * * *'  # Every 2 hours
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [pollofpolls.no](https://www.pollofpolls.no) for providing comprehensive Norwegian polling data
- [Chart.js](https://www.chartjs.org/) for the excellent charting library
- [React](https://reactjs.org/) for the robust frontend framework

## 📞 Contact

For questions or suggestions, please open an issue on GitHub.

---

*This project is not affiliated with MDG (Miljøpartiet De Grønne) or pollofpolls.no. It is an independent analysis tool for educational and informational purposes.*
