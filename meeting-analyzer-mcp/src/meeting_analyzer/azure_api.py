"""REST API for Meeting Transcript Analyzer using Azure OpenAI.

Run with: uvicorn meeting_analyzer.azure_api:app --reload --port 8001

Requires AZURE_OPENAI_API_KEY environment variable to be set (or in .env file).
"""

import os
import json
import re
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
from openai import AzureOpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

app = FastAPI(
    title="Meeting Analyzer API (Azure OpenAI)",
    description="Analyze meeting transcripts using Azure OpenAI GPT models",
    version="0.1.0"
)


# Azure OpenAI Configuration
AZURE_CONFIGS = {
    "gpt-4.1": {
        "endpoint": "https://fy26-hackon-q3.openai.azure.com/",
        "deployment": "fy26-hackon-q3-gpt-4.1",
        "api_version": "2025-01-01-preview",
        "api_key_env": "AZURE_OPENAI_API_KEY_GPT41",
    },
    "gpt-5": {
        "endpoint": "https://siddh-m9gwv1hd-eastus2.cognitiveservices.azure.com/",
        "deployment": "hackon-fy26q3-gpt5",
        "api_version": "2025-01-01-preview",
        "api_key_env": "AZURE_OPENAI_API_KEY_GPT5",
    },
}


# Request/Response models
class TranscriptRequest(BaseModel):
    transcript: str
    meeting_duration_minutes: Optional[int] = None
    meeting_booked_duration: Optional[int] = None
    expected_attendees: Optional[int] = None
    model: Literal["gpt-4.1", "gpt-5"] = "gpt-4.1"


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
    model_used: str
    timeDifference: Optional[int] = None  # Difference between booked and actual duration (in minutes)


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


def get_azure_client(model: str = "gpt-4.1") -> tuple[AzureOpenAI, str]:
    """Initialize Azure OpenAI client.
    
    Args:
        model: Model to use ("gpt-4.1" or "gpt-5")
    
    Returns:
        Tuple of (client, deployment_name)
    """
    if model not in AZURE_CONFIGS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model. Choose from: {list(AZURE_CONFIGS.keys())}"
        )
    
    config = AZURE_CONFIGS[model]
    api_key_env = config["api_key_env"]
    api_key = os.environ.get(api_key_env)
    
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail=f"{api_key_env} environment variable not set for model {model}"
        )
    
    client = AzureOpenAI(
        api_key=api_key,
        api_version=config["api_version"],
        azure_endpoint=config["endpoint"],
    )
    
    return client, config["deployment"]


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "Meeting Analyzer API (Azure OpenAI)",
        "status": "running",
        "available_models": list(AZURE_CONFIGS.keys()),
        "endpoints": {
            "POST /analyze": "Analyze a transcript and get structured JSON response",
            "POST /analyze/prompt": "Get the analysis prompt for a transcript (legacy)",
            "GET /health": "Health check",
            "GET /models": "List available models"
        }
    }


@app.get("/health")
async def health():
    """Health check."""
    api_key_configured = bool(os.environ.get("AZURE_OPENAI_API_KEY"))
    return {
        "status": "healthy",
        "azure_openai_api_configured": api_key_configured,
        "available_models": list(AZURE_CONFIGS.keys())
    }


@app.get("/models")
async def list_models():
    """List available Azure OpenAI models."""
    return {
        "models": [
            {
                "id": "gpt-4.1",
                "name": "GPT-4.1",
                "deployment": AZURE_CONFIGS["gpt-4.1"]["deployment"],
                "endpoint": AZURE_CONFIGS["gpt-4.1"]["endpoint"],
            },
            {
                "id": "gpt-5",
                "name": "GPT-5",
                "deployment": AZURE_CONFIGS["gpt-5"]["deployment"],
                "endpoint": AZURE_CONFIGS["gpt-5"]["endpoint"],
            }
        ]
    }


@app.post("/analyze", response_model=MeetingAnalysis)
async def analyze_transcript(request: TranscriptRequest):
    """
    Analyze a meeting transcript and return structured insights.
    
    This endpoint uses Azure OpenAI to analyze the transcript and returns:
    - Action items with owners and deadlines
    - Open/unresolved points
    - Follow-up assessment
    - Fruitfulness score and verdict
    
    Args:
        request: TranscriptRequest with transcript and optional model selection
    """
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")
    
    # Build the prompt
    prompt = ANALYSIS_PROMPT.format(transcript=request.transcript)
    
    # Add context if provided
    context_parts = []
    if request.meeting_booked_duration:
        context_parts.append(f"Meeting booked duration: {request.meeting_booked_duration} minutes")
    if request.meeting_duration_minutes:
        context_parts.append(f"Actual meeting duration: {request.meeting_duration_minutes} minutes")
    if request.expected_attendees:
        context_parts.append(f"Expected attendees: {request.expected_attendees}")
    
    if context_parts:
        context = "\n".join(context_parts)
        prompt = f"Context:\n{context}\n\n{prompt}"
    
    try:
        # Initialize Azure OpenAI client
        client, deployment = get_azure_client(request.model)
        
        # Call Azure OpenAI API
        response = client.chat.completions.create(
            model=deployment,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert meeting analyst. Analyze meeting transcripts and extract actionable insights in JSON format."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=4096,
            temperature=0.7,
            top_p=0.95,
        )
        
        # Extract response text
        response_text = response.choices[0].message.content
        
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
                    detail=f"Failed to parse LLM response as JSON. Response: {response_text[:500]}"
                )
        
        # Calculate time difference if both booked and actual duration are provided
        time_difference = None
        if request.meeting_booked_duration is not None and request.meeting_duration_minutes is not None:
            time_difference = request.meeting_booked_duration - request.meeting_duration_minutes
        
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
            ),
            model_used=request.model,
            timeDifference=time_difference
        )
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze/prompt", response_model=AnalysisPrompt)
async def get_analysis_prompt(request: TranscriptRequest):
    """
    Generate an analysis prompt for a meeting transcript (legacy endpoint).
    
    Returns a prompt that can be sent to an LLM to analyze the meeting.
    """
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")
    
    # Build the full prompt
    prompt = ANALYSIS_PROMPT.format(transcript=request.transcript)
    
    # Add context if provided
    context_parts = []
    if request.meeting_booked_duration:
        context_parts.append(f"Meeting booked duration: {request.meeting_booked_duration} minutes")
    if request.meeting_duration_minutes:
        context_parts.append(f"Actual meeting duration: {request.meeting_duration_minutes} minutes")
    if request.expected_attendees:
        context_parts.append(f"Expected attendees: {request.expected_attendees}")
    
    if context_parts:
        context = "\n".join(context_parts)
        prompt = f"Context:\n{context}\n\n{prompt}"
    
    return AnalysisPrompt(
        prompt=prompt,
        instructions=f"Send this prompt to Azure OpenAI ({request.model}) to get the analysis"
    )


# Entry point for running directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

