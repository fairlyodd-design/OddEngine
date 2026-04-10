
This pass adds:
- YouTube/Gumroad auth bridge starter
- metadata generation for YouTube/Gumroad
- auth probe + auth start buttons in Publish Panel

Expected backend endpoints:
- GET /publish/auth/health
- POST /publish/auth/start

This is still a safe starter and does not include production OAuth token storage.
