
This pass adds real publisher connector flow starters:
- connector bridge client
- connector start/finalize controls
- provider discovery
- backend starter for YouTube, Gumroad, KDP, TikTok

Expected backend endpoints:
- GET /connectors/health
- GET /connectors/providers
- POST /connectors/start
- POST /connectors/finalize

This remains a safe integration starter and does not yet include live publisher SDK uploads.
