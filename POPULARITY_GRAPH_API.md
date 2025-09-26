# 📈 **Popularity Graph API Documentation**

## 🚀 **New Feature: Repository Popularity Analytics**

### **Endpoint**
```
GET /popularity/:owner/:repo
```

### **Description**
Fetches comprehensive popularity and engagement data for frontend graph visualization including:
- Star progression estimates
- Commit activity over time
- Code frequency (additions/deletions)
- Top contributors
- Language distribution
- Repository health metrics

### **Example Request**
```bash
curl http://localhost:3000/popularity/facebook/react
curl http://localhost:3000/popularity/microsoft/vscode
curl http://localhost:3000/popularity/expressjs/express
```

### **Sample Response Structure**
```json
{
  "success": true,
  "repository": {
    "owner": "facebook",
    "repo": "react",
    "name": "react",
    "description": "The library for web and native user interfaces.",
    "created_at": "2013-05-24T16:15:54Z",
    "updated_at": "2025-09-26T10:30:00Z",
    "url": "https://github.com/facebook/react"
  },
  "currentStats": {
    "stars": 228543,
    "forks": 46789,
    "watchers": 6789,
    "openIssues": 234,
    "language": "JavaScript",
    "size": 456789
  },
  "graphData": {
    "commitActivity": [
      {
        "week": "2025-08-01",
        "commits": 45,
        "weekIndex": 0
      },
      {
        "week": "2025-08-08",
        "commits": 32,
        "weekIndex": 1
      }
    ],
    "starProgression": [
      {
        "month": "2013-05-01",
        "stars": 0,
        "monthIndex": 0
      },
      {
        "month": "2013-06-01",
        "stars": 150,
        "monthIndex": 1
      },
      {
        "month": "2025-09-01",
        "stars": 228543,
        "monthIndex": 148
      }
    ],
    "codeFrequency": [
      {
        "week": "2024-10-01",
        "additions": 1250,
        "deletions": 890,
        "net": 360,
        "weekIndex": 0
      }
    ],
    "languages": [
      {
        "language": "JavaScript",
        "bytes": 2500000,
        "percentage": "82.4"
      },
      {
        "language": "TypeScript", 
        "bytes": 450000,
        "percentage": "15.2"
      }
    ],
    "contributors": [
      {
        "login": "gaearon",
        "contributions": 1250,
        "avatar_url": "https://avatars.githubusercontent.com/u/810438?v=4",
        "html_url": "https://github.com/gaearon",
        "type": "User"
      }
    ]
  },
  "healthMetrics": {
    "starsPerMonth": "1547.2",
    "forksRatio": "0.20",
    "issuesRatio": "0.001",
    "contributorsCount": 20,
    "activeContributors": 15,
    "recentActivity": 125
  },
  "generatedAt": "2025-09-26T16:45:00.000Z",
  "note": "Star progression is estimated based on creation date and current stars. Commit activity and code frequency are actual GitHub data."
}
```

---

## 📊 **Frontend Integration Guide**

### **1. Line Chart - Commit Activity Over Time**
```javascript
// Use graphData.commitActivity
const commitChartData = {
  labels: data.graphData.commitActivity.map(item => item.week),
  datasets: [{
    label: 'Weekly Commits',
    data: data.graphData.commitActivity.map(item => item.commits),
    borderColor: 'rgb(75, 192, 192)',
    backgroundColor: 'rgba(75, 192, 192, 0.2)',
    tension: 0.1
  }]
};
```

### **2. Area Chart - Star Progression**
```javascript
// Use graphData.starProgression
const starChartData = {
  labels: data.graphData.starProgression.map(item => item.month),
  datasets: [{
    label: 'Stars Growth',
    data: data.graphData.starProgression.map(item => item.stars),
    fill: true,
    borderColor: 'rgb(255, 205, 86)',
    backgroundColor: 'rgba(255, 205, 86, 0.2)'
  }]
};
```

### **3. Bar Chart - Code Frequency (Additions vs Deletions)**
```javascript
// Use graphData.codeFrequency
const codeFreqData = {
  labels: data.graphData.codeFrequency.map(item => item.week),
  datasets: [
    {
      label: 'Additions',
      data: data.graphData.codeFrequency.map(item => item.additions),
      backgroundColor: 'rgba(34, 197, 94, 0.8)'
    },
    {
      label: 'Deletions',
      data: data.graphData.codeFrequency.map(item => item.deletions),
      backgroundColor: 'rgba(239, 68, 68, 0.8)'
    }
  ]
};
```

### **4. Pie Chart - Language Distribution**
```javascript
// Use graphData.languages
const languageData = {
  labels: data.graphData.languages.map(item => item.language),
  datasets: [{
    data: data.graphData.languages.map(item => parseFloat(item.percentage)),
    backgroundColor: [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'
    ]
  }]
};
```

### **5. Contributors List/Card Layout**
```javascript
// Use graphData.contributors
const contributorsList = data.graphData.contributors.map(contributor => ({
  name: contributor.login,
  contributions: contributor.contributions,
  avatar: contributor.avatar_url,
  profile: contributor.html_url
}));
```

### **6. Health Metrics Dashboard**
```javascript
// Use healthMetrics
const metrics = [
  { label: 'Stars/Month', value: data.healthMetrics.starsPerMonth },
  { label: 'Fork Ratio', value: data.healthMetrics.forksRatio },
  { label: 'Contributors', value: data.healthMetrics.contributorsCount },
  { label: 'Recent Activity', value: data.healthMetrics.recentActivity + ' commits' }
];
```

---

## 🎨 **Chart.js Integration Example**

### **HTML Structure**
```html
<div class="charts-container">
  <div class="chart-item">
    <canvas id="commitChart"></canvas>
  </div>
  <div class="chart-item">
    <canvas id="starChart"></canvas>
  </div>
  <div class="chart-item">
    <canvas id="languageChart"></canvas>
  </div>
  <div class="chart-item">
    <canvas id="codeFreqChart"></canvas>
  </div>
</div>
```

### **JavaScript Implementation**
```javascript
async function loadPopularityCharts(owner, repo) {
  try {
    const response = await fetch(`/popularity/${owner}/${repo}`);
    const data = await response.json();
    
    if (data.success) {
      // Commit Activity Chart
      new Chart(document.getElementById('commitChart'), {
        type: 'line',
        data: {
          labels: data.graphData.commitActivity.map(item => item.week),
          datasets: [{
            label: 'Weekly Commits',
            data: data.graphData.commitActivity.map(item => item.commits),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: 'Commit Activity (Last 6 Months)' }
          }
        }
      });
      
      // Star Progression Chart
      new Chart(document.getElementById('starChart'), {
        type: 'line',
        data: {
          labels: data.graphData.starProgression.map(item => item.month),
          datasets: [{
            label: 'Stars',
            data: data.graphData.starProgression.map(item => item.stars),
            fill: true,
            borderColor: 'rgb(255, 205, 86)',
            backgroundColor: 'rgba(255, 205, 86, 0.2)'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: 'Star Growth Over Time' }
          }
        }
      });
      
      // Language Distribution
      new Chart(document.getElementById('languageChart'), {
        type: 'doughnut',
        data: {
          labels: data.graphData.languages.map(item => item.language),
          datasets: [{
            data: data.graphData.languages.map(item => parseFloat(item.percentage)),
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: 'Language Distribution' }
          }
        }
      });
      
      // Code Frequency
      new Chart(document.getElementById('codeFreqChart'), {
        type: 'bar',
        data: {
          labels: data.graphData.codeFrequency.map(item => item.week),
          datasets: [
            {
              label: 'Additions',
              data: data.graphData.codeFrequency.map(item => item.additions),
              backgroundColor: 'rgba(34, 197, 94, 0.8)'
            },
            {
              label: 'Deletions', 
              data: data.graphData.codeFrequency.map(item => item.deletions),
              backgroundColor: 'rgba(239, 68, 68, 0.8)'
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: 'Code Changes (Last Year)' }
          }
        }
      });
      
    }
  } catch (error) {
    console.error('Error loading charts:', error);
  }
}

// Usage
loadPopularityCharts('facebook', 'react');
```

---

## 📱 **React Integration Example**

```jsx
import React, { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

const PopularityDashboard = ({ owner, repo }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchPopularityData = async () => {
      try {
        const response = await fetch(`/popularity/${owner}/${repo}`);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPopularityData();
  }, [owner, repo]);
  
  if (loading) return <div>Loading charts...</div>;
  if (!data || !data.success) return <div>Error loading data</div>;
  
  return (
    <div className="popularity-dashboard">
      <div className="stats-overview">
        <div className="stat-card">
          <h3>{data.currentStats.stars.toLocaleString()}</h3>
          <p>Stars</p>
        </div>
        <div className="stat-card">
          <h3>{data.currentStats.forks.toLocaleString()}</h3>
          <p>Forks</p>
        </div>
        <div className="stat-card">
          <h3>{data.healthMetrics.contributorsCount}</h3>
          <p>Contributors</p>
        </div>
      </div>
      
      <div className="charts-grid">
        <div className="chart-container">
          <h3>Commit Activity</h3>
          <Line data={commitChartData} />
        </div>
        
        <div className="chart-container">
          <h3>Language Distribution</h3>
          <Doughnut data={languageChartData} />
        </div>
        
        <div className="chart-container">
          <h3>Star Growth</h3>
          <Line data={starChartData} />
        </div>
        
        <div className="chart-container">
          <h3>Code Changes</h3>
          <Bar data={codeFreqData} />
        </div>
      </div>
    </div>
  );
};
```

---

## 🎯 **Key Benefits**

✅ **Real GitHub Data** - Actual commit activity, contributors, and code frequency  
✅ **Multiple Chart Types** - Line, bar, pie, and area charts supported  
✅ **Frontend Ready** - Structured data perfect for Chart.js, D3.js, or React charts  
✅ **Health Metrics** - Repository engagement and activity indicators  
✅ **Performance Optimized** - Efficient API calls with error handling  
✅ **Mobile Friendly** - Responsive chart data structure  

Your frontend can now create beautiful, interactive graphs showing repository popularity trends, contributor activity, and code evolution over time!