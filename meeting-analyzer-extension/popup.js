document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabs = document.querySelectorAll('.tab');
  const inputTab = document.getElementById('input-tab');
  const resultsTab = document.getElementById('results-tab');
  const transcriptInput = document.getElementById('transcript');
  const durationInput = document.getElementById('duration');
  const attendeesInput = document.getElementById('attendees');
  const modelSelect = document.getElementById('model');
  const endpointInput = document.getElementById('endpoint');
  const analyzeBtn = document.getElementById('analyze-btn');
  const btnText = analyzeBtn.querySelector('.btn-text');
  const btnLoader = analyzeBtn.querySelector('.btn-loader');
  const errorMessage = document.getElementById('error-message');
  const noResults = document.getElementById('no-results');
  const resultsContent = document.getElementById('results-content');

  // Input mode elements
  const modeBtns = document.querySelectorAll('.mode-btn');
  const transcriptMode = document.getElementById('transcript-mode');
  const jsonMode = document.getElementById('json-mode');
  const jsonBodyInput = document.getElementById('json-body');

  let currentInputMode = 'transcript';

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (tab.dataset.tab === 'input') {
        inputTab.classList.add('active');
        resultsTab.classList.remove('active');
      } else {
        inputTab.classList.remove('active');
        resultsTab.classList.add('active');
      }
    });
  });

  // Input mode switching
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInputMode = btn.dataset.mode;

      if (currentInputMode === 'transcript') {
        transcriptMode.classList.add('active');
        jsonMode.classList.remove('active');
      } else {
        transcriptMode.classList.remove('active');
        jsonMode.classList.add('active');
      }
    });
  });

  // Analyze button click
  analyzeBtn.addEventListener('click', async () => {
    let payload;

    if (currentInputMode === 'json') {
      // JSON mode - parse the JSON body directly
      const jsonText = jsonBodyInput.value.trim();
      if (!jsonText) {
        showError('Please enter a JSON request body');
        return;
      }

      try {
        payload = JSON.parse(jsonText);
      } catch (e) {
        showError('Invalid JSON: ' + e.message);
        return;
      }

      if (!payload.transcript) {
        showError('JSON must contain a "transcript" field');
        return;
      }
    } else {
      // Transcript mode - build payload from form fields
      const transcript = transcriptInput.value.trim();
      
      if (!transcript) {
        showError('Please enter a meeting transcript');
        return;
      }

      payload = {
        transcript: transcript,
        model: modelSelect.value,
        meeting_duration_minutes: parseInt(durationInput.value) || 30,
        expected_attendees: parseInt(attendeesInput.value) || 4
      };
    }

    // Show loading state
    setLoading(true);
    hideError();

    try {
      const endpoint = endpointInput.value.trim() || 'http://localhost:8001/analyze';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      displayResults(data);
      
      // Switch to results tab
      tabs.forEach(t => t.classList.remove('active'));
      tabs[1].classList.add('active');
      inputTab.classList.remove('active');
      resultsTab.classList.add('active');

    } catch (error) {
      console.error('Analysis error:', error);
      showError(error.message || 'Failed to analyze transcript. Make sure the API server is running.');
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    analyzeBtn.disabled = loading;
    btnText.classList.toggle('hidden', loading);
    btnLoader.classList.toggle('hidden', !loading);
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.classList.add('hidden');
  }

  function displayResults(data) {
    noResults.classList.add('hidden');
    resultsContent.classList.remove('hidden');
    
    let html = '';

    // Summary Section
    if (data.summary) {
      html += `
        <div class="result-section">
          <div class="result-header">
            <h3>📋 Summary</h3>
            <button class="copy-btn" data-copy="${escapeHtml(data.summary)}">Copy</button>
          </div>
          <div class="result-body">
            <p>${escapeHtml(data.summary)}</p>
          </div>
        </div>
      `;
    }

    // Key Topics
    if (data.key_topics && data.key_topics.length > 0) {
      html += `
        <div class="result-section">
          <div class="result-header">
            <h3>🎯 Key Topics</h3>
            <span class="badge">${data.key_topics.length}</span>
          </div>
          <div class="result-body">
            <ul>
              ${data.key_topics.map(topic => `<li>${escapeHtml(getItemText(topic, 'topic', 'name', 'title', 'text'))}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }

    // Action Items
    if (data.action_items && data.action_items.length > 0) {
      html += `
        <div class="result-section">
          <div class="result-header">
            <h3>✅ Action Items</h3>
            <span class="badge">${data.action_items.length}</span>
          </div>
          <div class="result-body">
            ${data.action_items.map(item => {
              const assignee = typeof item === 'object' ? getItemText(item, 'assignee', 'owner', 'responsible') : '';
              const task = getItemText(item, 'task', 'action', 'description', 'item', 'text');
              const deadline = typeof item === 'object' ? getItemText(item, 'deadline', 'due_date', 'dueDate', 'due') : '';
              const showAssignee = assignee && assignee !== task && !assignee.startsWith('{');
              const showDeadline = deadline && deadline !== task && !deadline.startsWith('{');
              return `
              <div class="action-item">
                ${showAssignee ? `<div class="assignee">${escapeHtml(assignee)}</div>` : ''}
                <div class="task">${escapeHtml(task)}</div>
                ${showDeadline ? `<div class="deadline">📅 ${escapeHtml(deadline)}</div>` : ''}
              </div>
            `}).join('')}
          </div>
        </div>
      `;
    }

    // Decisions
    if (data.decisions && data.decisions.length > 0) {
      html += `
        <div class="result-section">
          <div class="result-header">
            <h3>🔨 Decisions</h3>
            <span class="badge">${data.decisions.length}</span>
          </div>
          <div class="result-body">
            <ul>
              ${data.decisions.map(decision => `<li>${escapeHtml(getItemText(decision, 'decision', 'text', 'description', 'name'))}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }

    // Participants
    if (data.participants && data.participants.length > 0) {
      html += `
        <div class="result-section">
          <div class="result-header">
            <h3>👥 Participants</h3>
            <span class="badge">${data.participants.length}</span>
          </div>
          <div class="result-body">
            <ul>
              ${data.participants.map(p => `<li>${escapeHtml(getItemText(p, 'name', 'participant', 'person', 'text'))}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }

    // Raw JSON (collapsible)
    html += `
      <div class="result-section">
        <div class="result-header">
          <h3>🔧 Raw Response</h3>
          <button class="copy-btn" data-copy='${escapeHtml(JSON.stringify(data, null, 2))}'>Copy JSON</button>
        </div>
        <div class="result-body">
          <pre class="raw-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
        </div>
      </div>
    `;

    resultsContent.innerHTML = html;

    // Add copy functionality
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = btn.dataset.copy.startsWith('{') ? 'Copy JSON' : 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });
    });
  }

  function escapeHtml(text) {
    // Handle null/undefined
    if (text === null || text === undefined) {
      return '';
    }
    // Handle objects - convert to readable string
    if (typeof text === 'object') {
      text = JSON.stringify(text);
    }
    // Ensure it's a string
    text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper to extract text from potentially nested objects
  function getItemText(item, ...keys) {
    if (typeof item === 'string') return item;
    if (typeof item !== 'object' || item === null) return String(item);
    
    for (const key of keys) {
      if (item[key] !== undefined && item[key] !== null) {
        const val = item[key];
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      }
    }
    return JSON.stringify(item);
  }

  // Load sample transcript for demo
  const sampleTranscript = `**Aditi:** Lets get started on planning the Razorpay annual party. Any thoughts on dates?

**Rohit:** HR is suggesting mid-February, preferably a Friday so people can unwind properly.

**Mehul:** That works from the engineering side. No critical launches around that time.

**Pooja:** Great. For the theme, how about Neon Night or Retro Vibes?

**Rohit:** Retro Vibes feels more inclusive. People usually enjoy dressing up for it.

**Aditi:** Agreed. Lets tentatively lock Retro Vibes. What about the venue?`;

  // Pre-fill with sample on first load (optional - uncomment if desired)
  // transcriptInput.value = sampleTranscript;
});

