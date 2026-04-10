# v10.26.13g Bug Hunt Stabilization Sweep Pass

This pass focuses on stabilization from screenshots/video-first feedback rather than feature growth.

## Main fixes

- Hardened Grocery Meals saved-state migration and coupon feed rendering so older or sparse local state is less likely to crash the panel.
- Added a crash signature line to the error boundary so repeated runtime issues are easier to identify from screenshots.
- Re-attached Grow to the shell's compositor-safe root class so the existing safe-mode CSS actually applies to the panel.
- Added earlier container-based collapse rules for Grocery Meals, Family Entertainment, Cameras, News, Money, Family Budget, and Crypto Games to reduce cramped leftovers.
- Added extra min-width / overflow guards across shell containers and cards.

## Intent

Finish the polish work by reducing runtime surprises and layout squeeze before adding more features.
