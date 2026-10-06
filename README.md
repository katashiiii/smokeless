# SmokeLess PWA

A self-contained, offline-first iOS-friendly smoking reduction tracker.

## Run locally
A service worker requires HTTP(S), not `file://`.

From this folder:
- Python: `python -m http.server 8000`
- Then open `http://localhost:8000`

For iPhone installation, host the folder on any HTTPS static host (GitHub Pages, Netlify, Vercel, etc.), open it in Safari, then Share -> Add to Home Screen.

## Data
All tracking data is stored in the browser's localStorage. Use Settings -> Export JSON backup regularly.

## Notes
- The app does not require a backend or account.
- PWA install and notification behavior varies by iOS version.
- This is a self-tracking aid, not medical care.
