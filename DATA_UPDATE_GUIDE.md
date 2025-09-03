# 📊 Data Update Guide

## How to Ensure Your App Shows Updated Polling Data

### 🔄 **Data Flow Overview**

Your React app uses a **two-tier data system**:

1. **Primary Source**: `public/data/polling-data.json` (fetched via HTTP)
2. **Fallback Source**: `src/data/polling-data.json` (imported directly)

### 📁 **File Structure**
```
mdg-elections-compare/
├── data/polling-data.json           # Raw data (all polls)
├── public/data/polling-data.json    # Clean national data (for production)
├── src/data/polling-data.json       # Clean national data (fallback)
└── scripts/sync-data.js             # Sync script
```

---

## 🚀 **Quick Update Process**

### **Option 1: After Any Data Changes (Recommended)**
```bash
npm run sync-data
```
This automatically:
- Filters out regional polls from `data/polling-data.json`
- Updates both `public/data/polling-data.json` and `src/data/polling-data.json`
- Shows you the poll counts per election

### **Option 2: Manual Steps**
If you prefer to do it manually:

1. **Edit your data**: Make changes to `data/polling-data.json`

2. **Update public data**:
   ```bash
   # Copy national polls to public directory
   node scripts/fix-suspicious-patterns.js  # or any cleanup script
   ```

3. **Update fallback data**:
   ```bash
   # Copy the same data to src directory
   cp public/data/polling-data.json src/data/polling-data.json
   ```

---

## 🛠️ **Development vs Production**

### **During Development (`npm start`)**
- App tries to fetch from `public/data/polling-data.json`
- If that fails, uses `src/data/polling-data.json` as fallback
- **Both need to be updated** for consistency

### **In Production (GitHub Pages)**
- Only uses `public/data/polling-data.json`
- Gets deployed with `npm run build`

---

## ✅ **Complete Workflow Examples**

### **Scenario 1: You Added New Polls**
```bash
# 1. Fetch new data
npm run fetch-data

# 2. Sync to app locations
npm run sync-data

# 3. Test locally
npm start

# 4. Deploy when ready
npm run deploy
```

### **Scenario 2: You Fixed Data Quality Issues**
```bash
# 1. Run your cleanup script
node scripts/fix-suspicious-patterns.js

# 2. Sync changes
npm run sync-data

# 3. Build and deploy
npm run build
npm run deploy
```

### **Scenario 3: Manual Data Edits**
```bash
# 1. Edit data/polling-data.json manually
# 2. Sync changes
npm run sync-data

# 3. Verify changes
npm start
```

---

## 🔍 **Verification Commands**

### **Check Data Consistency**
```bash
# Compare file sizes (should be similar)
wc -l data/polling-data.json public/data/polling-data.json src/data/polling-data.json

# Check poll counts
npm run sync-data  # Shows counts per election
```

### **Test App Data Loading**
```bash
npm start
# Check browser console for: "Successfully fetched data from public directory"
```

---

## ⚡ **Pro Tips**

1. **Always run `npm run sync-data` after data changes** - it's your safety net
2. **The app will tell you** in the console which data source it's using
3. **Regional polls are automatically filtered out** during sync
4. **JSON syntax errors** will break the sync - fix them first
5. **Both files need to match** for development and production consistency

---

## 🚨 **Troubleshooting**

### **"Failed to fetch from public directory"**
- Check if `public/data/polling-data.json` exists
- Run `npm run sync-data` to create it

### **"JSON.parse: unexpected character"**
- There's a syntax error in your JSON
- Fix manually or run a cleanup script first

### **"App shows old data"**
- Clear browser cache
- Check both `public/` and `src/` data files are updated
- Restart development server (`npm start`)

### **"Charts look wrong"**
- Verify data sync: `npm run sync-data`
- Check console for data loading messages
- Ensure no regional polls contaminated the dataset

