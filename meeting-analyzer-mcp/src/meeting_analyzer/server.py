"""Meeting Transcript Analyzer - MCP Server

Analyzes meeting transcripts to determine if they were fruitful by extracting:
- Action items (with owners and deadlines)
- Open points (unresolved topics)
- Follow-up assessment
- Fruitfulness score
"""

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Prompt, PromptMessage, TextContent

app = Server("meeting-analyzer")

ANALYSIS_PROMPT = """Analyze this meeting transcript and extract the following information:

## 1. ACTION ITEMS
For each action item found in the transcript:
- Task: What needs to be done
- Owner: Who is responsible (if mentioned, otherwise mark as "Unassigned")
- Deadline: When it's due (if mentioned, otherwise mark as "Not specified")

## 2. OPEN POINTS
Topics that were discussed but NOT resolved:
- Topic: The unresolved issue or question
- Context: Why it remains open
- Blocking: Is this blocking other work? (Yes/No)

## 3. FOLLOW-UP ASSESSMENT
- Follow-up needed: Yes or No
- Reason: Why a follow-up is or isn't needed
- Suggested topics: If follow-up is needed, what should be discussed

## 4. MEETING FRUITFULNESS
- Score: 0-100 (based on decisions made, action items created, and issues resolved)
- Verdict: Fruitful / Partially Productive / Not Fruitful
- Explanation: Brief summary of why this score was given

TRANSCRIPT:
---
{transcript}
---

Provide your analysis in a clear, structured format using the sections above."""


@app.list_prompts()
async def list_prompts():
    """List available prompts."""
    return [
        Prompt(
            name="analyze-meeting",
            description="Analyze a meeting transcript to extract action items, open points, determine if follow-up is needed, and assess overall fruitfulness",
            arguments=[
                {
                    "name": "transcript",
                    "description": "The meeting transcript or notes to analyze",
                    "required": True
                }
            ]
        )
    ]


@app.get_prompt()
async def get_prompt(name: str, arguments: dict):
    """Get a specific prompt with arguments filled in."""
    if name == "analyze-meeting":
        transcript = arguments.get("transcript", "")
        if not transcript:
            raise ValueError("Transcript is required")
        
        return {
            "messages": [
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=ANALYSIS_PROMPT.format(transcript=transcript)
                    )
                )
            ]
        }
    
    raise ValueError(f"Unknown prompt: {name}")


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


def run():
    """Entry point for the CLI."""
    asyncio.run(main())


if __name__ == "__main__":
    run()

