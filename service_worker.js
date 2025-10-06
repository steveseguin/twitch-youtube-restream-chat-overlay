// service_worker.js
// This service worker is part of a Chrome Manifest V3 extension
// Service workers can only stay active a few minutes at a time before being forced closed by the browser

console.log("Chat Overlay service worker loaded");

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Chat Overlay extension installed");
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log("Chat Overlay extension starting up");
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Service worker received message:", message);

  // Handle any custom messages here if needed
  if (message.type) {
    // Process different message types
    switch(message.type) {
      case 'ping':
        sendResponse({ status: 'pong' });
        break;
      default:
        sendResponse({ status: 'unknown message type' });
    }
  }

  return true; // Indicates that the response will be sent asynchronously
});
