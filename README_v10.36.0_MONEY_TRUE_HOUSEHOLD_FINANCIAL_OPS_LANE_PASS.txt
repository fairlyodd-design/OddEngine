v10.36.0_MoneyTrueHouseholdFinancialOpsLanePass

What this pass does
- turns Money into a real household financial ops lane
- keeps the existing sellables / offer / export studio features
- adds a shared household-ops helper so Money can read:
  - Family Budget household picture
  - due-soon bills
  - projected free cash
  - debt focus
  - sellable ship focus
  - nearby Money/FamilyBudget calendar events

Files included
- ui/src/lib/moneyHouseholdOps.ts
- ui/src/panels/Money.tsx

What is new in Money
- top "Household financial ops" command surface
- projected free cash / bills due / debt focus / ship focus cards
- "Do this now" action queue
- ship-this-week lane
- better weekly review / calendar tie-in

Important truth
- this is a focused Money lift from the clean v10.35.9 base
- it does not claim a full repo-wide rebuild outside these files
