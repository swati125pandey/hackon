#!/bin/bash

# Meeting Analyzer API - Test Script
# Make sure the server is running: uvicorn meeting_analyzer.azure_api:app --reload --port 8001

API_URL="http://localhost:8001"

# Sample transcript
TRANSCRIPT='**Aditi:** Lets get started on planning the Razorpay annual party. Any thoughts on dates?

**Rohit:** HR is suggesting mid-February, preferably a Friday so people can unwind properly.

**Mehul:** That works from the engineering side. No critical launches around that time.

**Pooja:** Great. For the theme, how about Neon Night or Retro Vibes?

**Rohit:** Retro Vibes feels more inclusive. People usually enjoy dressing up for it.

**Aditi:** Agreed. Lets tentatively lock Retro Vibes. What about the venue?

**Mehul:** An outdoor venue would be fun, but we should have a backup in case of weather issues.

**Pooja:** Theres a resort near Bangalore that fits our headcount and budget. Ill share the details by tomorrow.

**Rohit:** Speaking of budget, we should try to keep everything within the allocated limit of 15 lakhs.

**Aditi:** Yes, well be mindful. Rohit, can you get the final headcount from HR by next Monday?

**Rohit:** Sure, Ill coordinate with the HR team and share the numbers.

**Mehul:** For entertainment, I suggest a DJ, some live music, and maybe a few internal performances.

**Pooja:** We can also add games or interactive zones. Ill create a list of activity ideas.

**Aditi:** Perfect. Mehul, can you check with the AV team about equipment requirements?

**Mehul:** Will do. Ill send an email today.

**Aditi:** Great progress everyone. Lets finalize details over the next few days and sync again on Friday. Meeting adjourned.'

echo "=========================================="
echo "Testing Meeting Analyzer API"
echo "=========================================="
echo ""

# Test 1: Health check
echo "1. Health Check"
echo "---------------"
curl -s "${API_URL}/health" | python3 -m json.tool
echo ""
echo ""

# Test 2: List models
echo "2. Available Models"
echo "-------------------"
curl -s "${API_URL}/models" | python3 -m json.tool
echo ""
echo ""

# Test 3: Analyze with GPT-4.1
echo "3. Analyze Transcript (GPT-4.1)"
echo "-------------------------------"
curl -s -X POST "${API_URL}/analyze" \
  -H "Content-Type: application/json" \
  -d "{
    \"transcript\": \"${TRANSCRIPT}\",
    \"model\": \"gpt-4.1\",
    \"meeting_duration_minutes\": 30,
    \"expected_attendees\": 4
  }" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "Tests Complete!"
echo "=========================================="

