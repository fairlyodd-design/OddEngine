
This pass adds:
- OAuth vault bridge client
- real uploader bridge client
- mock token store controls in Publish Panel
- backend starters for OAuth vault and uploader

Expected backend endpoints:
- GET /oauth/health
- GET /oauth/providers
- POST /oauth/store
- GET /uploader/health
- POST /uploader/submit

This is still a safe production-architecture starter. It does not include encrypted at-rest token storage or live platform SDK/OAuth callback completion yet.
