# DABSy v4 (source project)

Zero-dependency PWA. Native ES modules in `src/`; `npm run build` (node ≥18) copies to `dist/` and generates a versioned service worker.
Serve `dist/` over HTTPS (any static host). **AI backend URL is built in** (`src/ai.js` DEFAULT_API, overridable via `config.json` `apiUrl`): https://dabsy-ai.swagatdemo9292.workers.dev
Contract used (inherited from the V3 build): `GET /health -> {ok:true,model}`, `POST /chat {system,messages,tools}` -> SSE events `text{t}`, `tool{id,name,input}`, `done{stop}`, `error{message,code}`. Tools run on the device. No API keys in the frontend.

## Layout
src/brain.js (behaviour state machine) · character.js (gestures, physics, hop/perch/pose) · spots.js + spots.json (environment awareness) · widgets.js · chat.js · tools.js (butler tools + system prompt) · panels.js (tasks, calendar, study, settings) · layers.js (back button) · main.js (wiring)
Tests (need Playwright+Chromium): `python3 tests/mock_backend.py &` , serve dist on :8080, `python3 tests/e2e.py`, `python3 tests/spots_e2e.py`.

## Sitting spots
`tools/analyze_scenes.py` finds candidate horizontal edges in scene art. `src/spots.json` registers surfaces in image coordinates (with evidence). At runtime they are mapped through the real cover-crop, hard-edge spots snap to the actual pixel edge (or are dropped), spots she can't fit on are rejected, and perspective scale comes from the surface's depth. To add a scene: add art, run the analyzer, add entries.
