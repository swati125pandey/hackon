"""REST API for Meeting Transcript Analyzer.

Run with: uvicorn meeting_analyzer.api:app --reload

Requires GOOGLE_CLOUD_API_KEY environment variable to be set.
"""

import os
import json
import re
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from google import genai
from google.genai import types

app = FastAPI(
    title="Meeting Analyzer API",
    description="Analyze meeting transcripts to extract action items, open points, and assess fruitfulness",
    version="0.1.0"
)


# Request/Response models
class TranscriptRequest(BaseModel):
    transcript: str
    meeting_duration_minutes: Optional[int] = None
    expected_attendees: Optional[int] = None


class ActionItem(BaseModel):
    task: str
    owner: str
    deadline: str


class OpenPoint(BaseModel):
    topic: str
    context: str
    blocking: bool


class FollowUpAssessment(BaseModel):
    follow_up_needed: bool
    reason: str
    suggested_topics: list[str]


class MeetingFruitfulness(BaseModel):
    score: int
    verdict: str
    explanation: str


class MeetingAnalysis(BaseModel):
    action_items: list[ActionItem]
    open_points: list[OpenPoint]
    follow_up_assessment: FollowUpAssessment
    fruitfulness: MeetingFruitfulness


class AnalysisPrompt(BaseModel):
    prompt: str
    instructions: str


ANALYSIS_PROMPT = """Analyze this meeting transcript and extract the following information.

IMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.

The JSON structure must be:
{{
  "action_items": [
    {{
      "task": "What needs to be done",
      "owner": "Who is responsible (use 'Unassigned' if not mentioned)",
      "deadline": "When it's due (use 'Not specified' if not mentioned)"
    }}
  ],
  "open_points": [
    {{
      "topic": "The unresolved issue or question",
      "context": "Why it remains open",
      "blocking": true or false
    }}
  ],
  "follow_up_assessment": {{
    "follow_up_needed": true or false,
    "reason": "Why a follow-up is or isn't needed",
    "suggested_topics": ["topic1", "topic2"]
  }},
  "fruitfulness": {{
    "score": 0-100,
    "verdict": "Fruitful" or "Partially Productive" or "Not Fruitful",
    "explanation": "Brief summary of why this score was given"
  }}
}}

Guidelines:
- action_items: Extract all tasks with clear ownership. Use "Unassigned" if no owner is mentioned.
- open_points: Topics discussed but NOT resolved. Set blocking=true if it blocks other work.
- follow_up_assessment: Determine if another meeting is needed based on open points and pending decisions.
- fruitfulness: Score based on decisions made, action items created, and issues resolved.
  - 80-100: Fruitful (clear decisions, good progress)
  - 50-79: Partially Productive (some progress, open items remain)
  - 0-49: Not Fruitful (no clear outcomes, wasted time)

TRANSCRIPT:
---
{transcript}
---

Respond with ONLY the JSON object, no other text."""


LEGACY_ANALYSIS_PROMPT = """Analyze this meeting transcript and extract the following information:

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


def get_gemini_client():
    """Initialize Gemini client with Vertex AI."""
    api_key = os.environ.get("GOOGLE_CLOUD_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_CLOUD_API_KEY environment variable not set"
        )
    
    return genai.Client(
        vertexai=True,
        api_key=api_key,
    )


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "Meeting Analyzer API",
        "status": "running",
        "endpoints": {
            "POST /analyze": "Analyze a transcript and get structured JSON response",
            "POST /analyze/prompt": "Get the analysis prompt for a transcript (legacy)",
            "GET /health": "Health check"
        }
    }


@app.get("/health")
async def health():
    """Health check."""
    api_key_configured = bool(os.environ.get("GOOGLE_CLOUD_API_KEY"))
    return {
        "status": "healthy",
        "gemini_api_configured": api_key_configured
    }


@app.post("/analyze", response_model=MeetingAnalysis)
async def analyze_transcript(request: TranscriptRequest):
    """
    Analyze a meeting transcript and return structured insights.
    
    This endpoint uses Gemini to analyze the transcript and returns:
    - Action items with owners and deadlines
    - Open/unresolved points
    - Follow-up assessment
    - Fruitfulness score and verdict
    """
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")
    
    # Build the prompt
    prompt = ANALYSIS_PROMPT.format(transcript=request.transcript)
    
    # Add context if provided
    context_parts = []
    if request.meeting_duration_minutes:
        context_parts.append(f"Meeting duration: {request.meeting_duration_minutes} minutes")
    if request.expected_attendees:
        context_parts.append(f"Expected attendees: {request.expected_attendees}")
    
    if context_parts:
        context = "\n".join(context_parts)
        prompt = f"Context:\n{context}\n\n{prompt}"
    
    try:
        # Initialize Gemini client
        client = get_gemini_client()
        
        # Build content for Gemini
        contents = [
            types.Content(
                role="user",
                parts=[types.Part(text=prompt)]
            )
        ]
        
        # Configure generation settings
        generate_content_config = types.GenerateContentConfig(
            temperature=0.7,
            top_p=0.95,
            max_output_tokens=4096,
        )
        
        # Call Gemini API
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=contents,
            config=generate_content_config,
        )
        
        # Extract response text
        response_text = response.text
        
        # Parse JSON response
        try:
            analysis_data = json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract JSON from response if it contains extra text
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                analysis_data = json.loads(json_match.group())
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to parse LLM response as JSON"
                )
        
        # Build response model
        return MeetingAnalysis(
            action_items=[
                ActionItem(**item) for item in analysis_data.get("action_items", [])
            ],
            open_points=[
                OpenPoint(**point) for point in analysis_data.get("open_points", [])
            ],
            follow_up_assessment=FollowUpAssessment(
                **analysis_data.get("follow_up_assessment", {
                    "follow_up_needed": False,
                    "reason": "Unable to determine",
                    "suggested_topics": []
                })
            ),
            fruitfulness=MeetingFruitfulness(
                **analysis_data.get("fruitfulness", {
                    "score": 0,
                    "verdict": "Unable to analyze",
                    "explanation": "Analysis failed"
                })
            )
        )
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze/prompt", response_model=AnalysisPrompt)
async def get_analysis_prompt(request: TranscriptRequest):
    """
    Generate an analysis prompt for a meeting transcript (legacy endpoint).
    
    Returns a prompt that can be sent to an LLM (Claude, GPT-4, Gemini, etc.)
    to analyze the meeting and extract insights.
    """
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")
    
    # Build the full prompt
    prompt = LEGACY_ANALYSIS_PROMPT.format(transcript=request.transcript)
    
    # Add context if provided
    context_parts = []
    if request.meeting_duration_minutes:
        context_parts.append(f"Meeting duration: {request.meeting_duration_minutes} minutes")
    if request.expected_attendees:
        context_parts.append(f"Expected attendees: {request.expected_attendees}")
    
    if context_parts:
        context = "\n".join(context_parts)
        prompt = f"Context:\n{context}\n\n{prompt}"
    
    return AnalysisPrompt(
        prompt=prompt,
        instructions="Send this prompt to an LLM (Claude, GPT-4, Gemini) to get the analysis"
    )


# Entry point for running directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
