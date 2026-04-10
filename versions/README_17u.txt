
This pass adds:
- encrypted secrets vault bridge client
- oauth callback completion bridge client
- Publish Panel controls for encrypted secrets + callback completion
- backend starters:
  - encrypted-secrets-vault-starter.mjs
  - oauth-callback-completion-starter.mjs

Expected backend endpoints:
- GET /secrets/health
- GET /secrets/providers
- POST /secrets/store
- GET /oauth/callback/health
- POST /oauth/callback/complete

This is still a safe production-architecture starter and does not yet include:
- real secure key management
- production OAuth redirect handling
- encrypted persistent disk vault implementation
