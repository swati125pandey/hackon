# Calendar Dashboard

A simple HTML-based dashboard for tracking meeting statistics and employee efficiency.

## Features

- **Total Meetings**: Shows the total number of meetings in the selected week
- **Total Meeting Time**: Displays total minutes spent in meetings
- **Meetings with Action Items**: Count of meetings that have action items
- **Weekly Efficiency**: Calculated as (meetings with action items / total meetings) × 100%
- **Employee Breakdown**: Detailed statistics per employee ID including:
  - Number of meetings
  - Total minutes
  - Meetings with action items
  - Individual efficiency percentage

## Usage

1. Open `index.html` in a web browser
2. Select a week using the week selector at the top
3. Load meeting data by either:
   - Pasting JSON data into the textarea and clicking "Load JSON Data"
   - Uploading a JSON file using the "Upload JSON File" button
   - You can use `sample-data.json` as a reference or test file
4. View the dashboard metrics update automatically

## JSON Data Format

The dashboard expects a JSON array of meeting objects. Each meeting object should have the following structure:

```json
[
  {
    "employeeId": "EMP001",
    "date": "2024-01-15",
    "duration": 30,
    "hasActionItems": true,
    "timeDifference": 5,
    "efficiency": 85
  },
  {
    "employeeId": "EMP002",
    "date": "2024-01-16",
    "duration": 60,
    "hasActionItems": false,
    "timeDifference": -10,
    "efficiency": 70
  }
]
```

### Field Descriptions:
- **employeeId** (string, required): Unique identifier for the employee
- **date** (string, required): Meeting date in YYYY-MM-DD format
- **duration** (number, required): Meeting duration in minutes (must be > 0)
- **hasActionItems** (boolean, required): Whether the meeting has action items
- **timeDifference** (number, optional): Minutes difference from scheduled time. Positive values indicate overshot (took longer), negative values indicate undershot (took less time), zero means exactly on time
- **efficiency** (number, optional): Efficiency percentage for the meeting (typically 0-100). The dashboard calculates average efficiency per employee and globally from this field

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and layout
- `script.js` - Dashboard logic and data management
- `README.md` - This file

## Browser Compatibility

Works in all modern browsers that support:
- HTML5 (week input type)
- CSS3 (Grid, Flexbox)
- ES6 JavaScript (localStorage, arrow functions)

