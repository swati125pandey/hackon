# Meeting Analyzer MCP

A simple MCP (Model Context Protocol) server that analyzes meeting transcripts to determine if they were fruitful.

## What It Extracts

- **Action Items**: Tasks with owners and deadlines
- **Open Points**: Unresolved topics from the meeting
- **Follow-up Assessment**: Whether another meeting is needed
- **Fruitfulness Score**: 0-100 rating of meeting productivity

## Setup

### 1. Install dependencies

```bash
cd meeting-analyzer-mcp

# Using uv (recommended)
uv sync --python 3.11

# Or using pip (requires Python 3.10+)
pip install -e .
```

### 2. Configure Cursor

Add to your Cursor MCP config file (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "meeting-analyzer": {
      "command": "uv",
      "args": ["run", "--directory", "/Users/swati.pandey/hackon/meeting-analyzer-mcp", "meeting-analyzer"]
    }
  }
}
```

### 3. Restart Cursor

Restart Cursor to load the MCP server.

## Usage

In Cursor chat, you can use the `analyze-meeting` prompt:

1. Type: "Use the analyze-meeting prompt"
2. Paste your meeting transcript
3. Get structured analysis

### Example

**Input transcript:**
```
Team sync - Dec 16, 2024

Sarah: Let's discuss the API redesign. John, where are we?
John: I've reviewed the options. I recommend we go with REST.
Sarah: Sounds good. Can you document the endpoints by Friday?
John: Sure, I'll have it ready.
Sarah: Great. We still need to decide on the auth mechanism though.
Mike: I'll set up a call with the security team this week.
```

**Output:**
```
## 1. ACTION ITEMS
| Task | Owner | Deadline |
|------|-------|----------|
| Document REST endpoints | John | Friday |
| Set up call with security team | Mike | This week |

## 2. OPEN POINTS
| Topic | Context | Blocking |
|-------|---------|----------|
| Auth mechanism decision | Needs security team input | No |

## 3. FOLLOW-UP ASSESSMENT
- Follow-up needed: Yes
- Reason: Auth mechanism still needs to be decided
- Suggested topics: Auth approach (OAuth vs API keys)

## 4. MEETING FRUITFULNESS
- Score: 72/100
- Verdict: Partially Productive
- Explanation: Good progress on API design with clear action items, but key auth decision deferred.
```

## Project Structure

```
meeting-analyzer-mcp/
├── src/
│   └── meeting_analyzer/
│       ├── __init__.py
│       └── server.py      # MCP server
├── pyproject.toml
└── README.md
```

## Development

Run the server directly:

```bash
uv run meeting-analyzer
```
