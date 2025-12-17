# Meeting Analyzer Chrome Extension

A simple Chrome extension to analyze meeting transcripts using the Meeting Analyzer API.

## Features

- 📋 Paste meeting transcripts and get instant analysis
- 🎯 Extract key topics and discussion points
- ✅ Identify action items with assignees and deadlines
- 🔨 Capture decisions made during the meeting
- 👥 List meeting participants
- 📊 Configurable AI model selection

## Installation

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/` in your Chrome browser
   - Or go to Menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `meeting-analyzer-extension` folder
   - The extension icon should appear in your toolbar

## Usage

1. Click the extension icon in your Chrome toolbar
2. Paste your meeting transcript into the text area
3. Configure the optional settings:
   - **Duration**: Meeting duration in minutes
   - **Attendees**: Expected number of attendees
   - **Model**: Select the AI model (GPT-4o, GPT-4, GPT-5, etc.)
   - **API Endpoint**: The analyze endpoint URL (default: `http://localhost:8001/analyze`)
4. Click "Analyze Meeting"
5. View the results in the Results tab

## API Requirements

The extension expects the API server to be running at `http://localhost:8001` by default.

### Expected Request Format

```json
{
  "transcript": "Meeting transcript text...",
  "model": "gpt-4o",
  "meeting_duration_minutes": 30,
  "expected_attendees": 4
}
```

### Expected Response Format

```json
{
  "summary": "Brief meeting summary...",
  "key_topics": ["Topic 1", "Topic 2"],
  "action_items": [
    {
      "assignee": "Person Name",
      "task": "Task description",
      "deadline": "Due date"
    }
  ],
  "decisions": ["Decision 1", "Decision 2"],
  "participants": ["Person 1", "Person 2"]
}
```

## Development

### Files Structure

```
meeting-analyzer-extension/
├── manifest.json      # Extension configuration
├── popup.html         # Extension popup UI
├── popup.css          # Styles
├── popup.js           # Main logic
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Regenerating Icons

If you want to regenerate or customize the icons:

```bash
python3 create_icons.py
```

## Troubleshooting

- **"Failed to analyze transcript"**: Make sure the API server is running at the specified endpoint
- **CORS errors**: The API server needs to allow requests from `chrome-extension://` origins
- **Extension not loading**: Check that Developer Mode is enabled and all files are present

## License

MIT

