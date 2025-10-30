## Alternate Content Scripts

This directory holds the newer **Social Stream Ninja** content scripts.  
They currently ship with the companion project where chats are captured
automatically and piped through a background hub.  

For **Chat Overlay for Youtube, Twitch & more** we still rely on the older,
manual flow: the user clicks a message on the page and we forward that payload
straight to OBS. The scripts under `sources_alt/` therefore need extra work
before they can live under `sources/`.

### How to evaluate a script

1. **Identify the message container**  
   Look for selectors passed to a `MutationObserver`, e.g.
   `.chat-entry-content`, `.chat-history--row`, `div[id^="message-content-"]`.
   Those selectors become the ones we must register a click handler on.

2. **Strip the automation layer**  
   Most files call `chrome.runtime.sendMessage(...)` or maintain a send queue.
   Replace that with the existing `pushMessage()` / `actionwtf()` workflow that
   lives in our legacy scripts (see `sources/youtube.js`).

3. **Preserve manual affordances**  
   The overlay expects the clicked element to:
   - receive a `shown-comment` class (so the user knows it was pushed), and
   - stay clickable for replays.
   Ensure we re-use the helpers from the legacy scripts (`highlightWords`,
   membership handling, etc.), or copy over whatever is missing.

4. **Keep settings minimal**  
   Social Stream Ninja exposes a large `settings` object (hype mode, dedupe,
   automatic replies). We should only keep the pieces that map to this
   extension—usually `textonlymode`, `showOnlyFirstName` and `highlightWords`.

### High-priority candidates

- **Kick** (`kick.js`)  
  - Message nodes: `.chat-entry`, `.chat-message`, and the popout wrapper `div[data-index]`.  
  - User name: `button[title]` / `.chat-entry-username`.  
  - Badges: `.chat-message-identity .badge-tooltip img`.  
  - To adapt: remove the MutationObserver loop, bind a single click handler to
    the message containers, and reuse the existing Twitch badge rendering code.  
  - Status: promoted—`sources/kick.js` is now registered in the manifest. Smoke
    test in the popout chat to confirm overlay/link buttons render, message rows
    show a pointer cursor, and clicks outlined in blue reach the overlay.

- **Rumble** (`rumble.js`)  
  - Message nodes: `.chat-history--row`.  
  - User name: `.chat-history--username`.  
  - Donation tags: `.chat-history--rant-price`.  
  - To adapt: convert the current auto-forwarder so the click handler builds
    the payload (membership, rant price, optional channel image) and calls
    `pushMessage`.

- **Discord** (`discord.js`)  
  - Message nodes: `div[id^="chat-messages-"]`.  
  - User avatar: `img[class*='avatar-']`.  
  - Rich embeds already normalised by `getAllContentNodes()`.  
  - To adapt: reuse the helper that resolves previous avatar/name for threaded
    replies, but trigger it from a manual click instead of the observer.

These three are popular requests, share similar badge/message structures with
existing integrations, and should port cleanly once the manual click pipeline
is wired up. Less common services (e.g. webinars, internal tools) can remain in
`sources_alt/` until we have the bandwidth—and ideally test coverage—to vet
them properly.

> ✱ Tip: start by copying `sources/twitch.js` to a new file. Replace the
> Twitch-specific selectors with those from the candidate script, then port any
> data-munging helpers (badge parsing, image handling) across.

Keep this file updated as you evaluate more scripts so we have a running
checklist of what is ready, what still needs work, and which selectors are safe
to lean on.
