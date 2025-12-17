// Meeting Analyzer - Background Service Worker

// Store transcript data
let currentTranscript = [];
let meetingActive = false;
let meetingStartTime = null;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Meeting Analyzer] Background received:', message.type);

  if (message.type === 'MEETING_STARTED') {
    meetingActive = true;
    meetingStartTime = Date.now();
    currentTranscript = [];
    console.log('[Meeting Analyzer] Meeting started');
    sendResponse({ success: true });
  }
  
  if (message.type === 'TRANSCRIPT_UPDATE') {
    if (message.entries && message.entries.length > 0) {
      currentTranscript = message.entries;
      console.log('[Meeting Analyzer] Transcript updated:', currentTranscript.length, 'entries');
    }
    sendResponse({ success: true });
  }
  
  if (message.type === 'MEETING_ENDED') {
    meetingActive = false;
    const duration = meetingStartTime ? Math.round((Date.now() - meetingStartTime) / 60000) : 30;
    
    // Store the transcript for the popup to access
    chrome.storage.local.set({
      lastMeetingTranscript: currentTranscript,
      lastMeetingDuration: duration || 1,
      lastMeetingTime: Date.now(),
      lastParticipantCount: message.participantCount || 2,
      autoAnalyze: true
    });
    
    console.log('[Meeting Analyzer] Meeting ended, transcript saved:', currentTranscript.length, 'entries');
    sendResponse({ success: true, transcriptLength: currentTranscript.length });
  }
  
  if (message.type === 'GET_TRANSCRIPT') {
    sendResponse({ 
      transcript: currentTranscript,
      meetingActive: meetingActive,
      duration: meetingStartTime ? Math.round((Date.now() - meetingStartTime) / 60000) : 0
    });
  }
  
  return true; // Keep message channel open for async response
});

// Log when service worker starts
console.log('[Meeting Analyzer] Background service worker initialized');

