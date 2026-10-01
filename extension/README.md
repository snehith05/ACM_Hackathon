# VeriLens Chrome Extension

Check any image on the web for AI generation / editing, with explainable evidence (not a bare verdict).

## Install (developer mode)
1. Start the VeriLens backend: `cd backend && python -m uvicorn main:app --port 8000`
2. Open `chrome://extensions`, turn on **Developer mode**
3. Click **Load unpacked** and choose this `extension/` folder
4. Pin the VeriLens icon to the toolbar

## Use
- **Right-click any image** on a page → **Check with VeriLens** (result appears in a panel on the page)
- Or click the toolbar icon → drop / browse / paste an image, or paste an image URL

## Settings (⚙ in the popup)
- **Backend URL** — default `http://127.0.0.1:8000`
- **Web app URL** — default `http://localhost:5173` (for "Open full VeriLens report")
- **Gemini API key** — optional; stored only in this browser profile. Without it the backend uses its own key or built-in checks.

Images are sent only to the backend URL you configure.
