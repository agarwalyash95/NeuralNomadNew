# Testing and Launch Readiness
## Infrastructure
- Pytest cache exists in backend, indicating pytest is used.
- No obvious heavy end-to-end testing suite (like Cypress/Playwright) is visible at the root.

## Readiness
The platform is functionally rich but requires extensive integration testing to guarantee the complex state machine (Chat -> Draft -> Plan -> Booked) is unbreakable by concurrent user actions.
