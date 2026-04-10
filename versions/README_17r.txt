
This pass adds the real-world publish integration starter:
- live publish bridge client
- Publish Panel with live publish button
- starter backend publish bridge at backend_scaffold/publish-bridge-starter.mjs

Expected backend endpoints:
- GET /publish/health
- POST /publish/submit

This is a safe integration starter. It does not yet include live OAuth/API auth for YouTube, Gumroad, KDP, or TikTok.
