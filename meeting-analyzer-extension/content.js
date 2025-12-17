// Meeting Analyzer - Google Meet Content Script
(function() {
  'use strict';

  let isCapturing = false;
  let transcriptEntries = [];
  let captionObserver = null;
  let lastCaptionText = '';
  let participantCount = new Set();
  let pollInterval = null;
  let monitorInterval = null;

  console.log('[Meeting Analyzer] Content script loaded on Google Meet');

  // Check if we're in a meeting
  function isInMeeting() {
    // Check for various meeting indicators
    const meetingCode = document.querySelector('[data-meeting-code]');
    const meetingId = document.querySelector('[data-unresolved-meeting-id]');
    const callControls = document.querySelector('[data-call-button-type]');
    const meetingPath = window.location.pathname.length > 5 && 
                       !window.location.pathname.includes('landing') &&
                       !window.location.pathname.includes('lookup');
    
    return meetingCode !== null || meetingId !== null || callControls !== null || meetingPath;
  }

  // Check if meeting has ended
  function hasMeetingEnded() {
    // Look for "You left the meeting" or return indicators
    const bodyText = document.body.innerText;
    const leftMeeting = bodyText.includes('You left the meeting') ||
                       bodyText.includes('The meeting has ended') ||
                       bodyText.includes('You\'ve left the meeting');
    
    // Check for rejoin/return buttons
    const rejoinButton = document.querySelector('[aria-label="Rejoin"]') ||
                        document.querySelector('[aria-label="Return to home screen"]') ||
                        document.querySelector('button[jsname="Qx7uuf"]');
    
    // Check if call controls are gone
    const callControls = document.querySelector('[data-call-button-type]');
    
    return leftMeeting || (rejoinButton !== null && callControls === null);
  }

  // Extract captions/transcript from Google Meet
  function extractCaptions() {
    // Multiple selectors for different Google Meet caption implementations
    const selectors = [
      '[data-message-text]',
      '.iTTPOb',
      '.TBMuR',
      '.Mz6pEf',
      '[jsname="tgaKEf"]',
      '.iOzk7'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        extractFromElements(elements);
        return;
      }
    }

    // Try to find caption container by structure
    const captionContainer = document.querySelector('[jsname="dsyhDe"]') ||
                            document.querySelector('.a4cQT') ||
                            document.querySelector('[data-self-name]')?.closest('div')?.parentElement;
    
    if (captionContainer) {
      extractFromContainer(captionContainer);
    }
  }

  function extractFromElements(elements) {
    elements.forEach(el => {
      const text = el.textContent?.trim();
      if (!text || text === lastCaptionText) return;
      
      // Try to find speaker name
      let speaker = 'Unknown';
      const speakerEl = el.closest('[data-sender-name]') ||
                       el.parentElement?.querySelector('[data-sender-name]') ||
                       el.closest('[data-participant-id]');
      
      if (speakerEl) {
        speaker = speakerEl.getAttribute('data-sender-name') || 
                 speakerEl.textContent?.split(':')[0]?.trim() || 
                 'Unknown';
      }
      
      addTranscriptEntry(speaker, text);
    });
  }

  function extractFromContainer(container) {
    const textNodes = container.querySelectorAll('span, div');
    let currentSpeaker = 'Unknown';
    
    textNodes.forEach(node => {
      const text = node.textContent?.trim();
      if (!text) return;
      
      // Check if this looks like a speaker name
      if (text.endsWith(':') || node.classList.contains('zs7s8d')) {
        currentSpeaker = text.replace(':', '').trim();
        participantCount.add(currentSpeaker);
      } else if (text.length > 1 && text !== lastCaptionText) {
        addTranscriptEntry(currentSpeaker, text);
      }
    });
  }

  function addTranscriptEntry(speaker, text) {
    if (text === lastCaptionText) return;
    
    lastCaptionText = text;
    participantCount.add(speaker);
    
    const entry = {
      speaker: speaker,
      text: text,
      timestamp: new Date().toISOString()
    };
    
    transcriptEntries.push(entry);
    
    // Send update to background
    chrome.runtime.sendMessage({ 
      type: 'TRANSCRIPT_UPDATE', 
      entries: transcriptEntries 
    }).catch(() => {});
    
    console.log('[Meeting Analyzer] Caption:', speaker, '-', text.substring(0, 50) + '...');
  }

  // Start capturing
  function startCapture() {
    if (isCapturing) return;
    
    isCapturing = true;
    transcriptEntries = [];
    participantCount.clear();
    lastCaptionText = '';
    
    console.log('[Meeting Analyzer] Starting transcript capture...');
    
    // Notify background script
    chrome.runtime.sendMessage({ type: 'MEETING_STARTED' }).catch(() => {});
    
    // Set up mutation observer to watch for captions
    captionObserver = new MutationObserver((mutations) => {
      extractCaptions();
    });
    
    // Observe the entire body for caption changes
    captionObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    // Also poll periodically as backup
    pollInterval = setInterval(extractCaptions, 1500);
    
    // Show indicator
    showCaptureIndicator();
  }

  // Stop capturing and send transcript
  function stopCapture() {
    if (!isCapturing) return;
    
    isCapturing = false;
    
    if (captionObserver) {
      captionObserver.disconnect();
      captionObserver = null;
    }
    
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    
    console.log('[Meeting Analyzer] Meeting ended. Captured', transcriptEntries.length, 'entries');
    
    // Send to background
    chrome.runtime.sendMessage({ 
      type: 'MEETING_ENDED',
      participantCount: participantCount.size
    }).catch(() => {});
    
    // Show notification
    showEndNotification();
    
    // Remove indicator
    removeCaptureIndicator();
  }

  // Show capture indicator
  function showCaptureIndicator() {
    if (document.getElementById('meeting-analyzer-indicator')) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'meeting-analyzer-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%);
        color: #0d0d0f;
        padding: 10px 16px;
        border-radius: 8px;
        font-family: 'Google Sans', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(34, 211, 238, 0.4);
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: default;
        user-select: none;
      ">
        <span style="
          width: 8px; 
          height: 8px; 
          background: #ef4444; 
          border-radius: 50%; 
          animation: ma-pulse 1.5s infinite;
        "></span>
        <span>Meeting Analyzer Active</span>
        <span id="ma-count" style="
          background: rgba(0,0,0,0.2);
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
        ">0 captions</span>
      </div>
      <style>
        @keyframes ma-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }
      </style>
    `;
    document.body.appendChild(indicator);
    
    // Update count periodically
    setInterval(() => {
      const countEl = document.getElementById('ma-count');
      if (countEl) {
        countEl.textContent = `${transcriptEntries.length} captions`;
      }
    }, 2000);
  }

  // Remove capture indicator
  function removeCaptureIndicator() {
    const indicator = document.getElementById('meeting-analyzer-indicator');
    if (indicator) indicator.remove();
  }

  // Show notification when meeting ends
  function showEndNotification() {
    const notification = document.createElement('div');
    notification.id = 'meeting-analyzer-notification';
    notification.innerHTML = `
      <div id="ma-backdrop" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
      "></div>
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #16161a;
        color: #f4f4f5;
        padding: 32px 40px;
        border-radius: 16px;
        font-family: 'Google Sans', Roboto, sans-serif;
        z-index: 10001;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        text-align: center;
        border: 1px solid #27272a;
        max-width: 400px;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
        <h2 style="font-size: 20px; margin: 0 0 8px 0; color: #22d3ee;">Transcript Captured!</h2>
        <p style="color: #a1a1aa; margin: 0 0 20px 0; font-size: 14px;">
          <strong>${transcriptEntries.length}</strong> entries from <strong>${participantCount.size}</strong> participants
        </p>
        <p style="color: #71717a; font-size: 13px; margin: 0 0 20px 0;">
          Click the Meeting Analyzer extension icon to analyze your meeting transcript.
        </p>
        <button id="ma-close-btn" style="
          padding: 12px 28px;
          background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%);
          border: none;
          border-radius: 8px;
          color: #0d0d0f;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        ">Got it!</button>
      </div>
    `;
    document.body.appendChild(notification);
    
    // Close handlers
    const closeNotification = () => notification.remove();
    document.getElementById('ma-close-btn')?.addEventListener('click', closeNotification);
    document.getElementById('ma-backdrop')?.addEventListener('click', closeNotification);
    
    // Auto-close after 15 seconds
    setTimeout(closeNotification, 15000);
  }

  // Monitor for meeting state changes
  function startMonitoring() {
    let wasInMeeting = false;
    let checkCount = 0;
    
    monitorInterval = setInterval(() => {
      const inMeeting = isInMeeting();
      const meetingEnded = hasMeetingEnded();
      
      checkCount++;
      
      // Log status every 30 seconds
      if (checkCount % 30 === 0) {
        console.log('[Meeting Analyzer] Status check - In meeting:', inMeeting, 'Ended:', meetingEnded, 'Capturing:', isCapturing);
      }
      
      if (inMeeting && !wasInMeeting && !meetingEnded) {
        // Meeting just started
        console.log('[Meeting Analyzer] Meeting detected, starting capture');
        wasInMeeting = true;
        // Small delay to let the meeting UI fully load
        setTimeout(startCapture, 2000);
      } else if (wasInMeeting && meetingEnded) {
        // Meeting just ended
        console.log('[Meeting Analyzer] Meeting ended detected');
        wasInMeeting = false;
        stopCapture();
      }
    }, 1000);
  }

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (isCapturing && transcriptEntries.length > 0) {
      // Try to save transcript before page unloads
      chrome.runtime.sendMessage({ 
        type: 'MEETING_ENDED',
        participantCount: participantCount.size
      }).catch(() => {});
    }
  });

  // Initialize
  function init() {
    console.log('[Meeting Analyzer] Initializing on Google Meet...');
    
    // Wait for page to be ready
    if (document.readyState === 'complete') {
      startMonitoring();
    } else {
      window.addEventListener('load', startMonitoring);
    }
  }

  // Start initialization
  init();
})();

