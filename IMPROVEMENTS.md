# Improvements for this project, sorted by priority.



**[p1]**

- [ ] refactor the repo into a monorepo (e.g. Nx), with module enforcement
- [ ] add contracts between frontend and backend (e.g. Zod) and validation at endpoints
- [ ] rearchitecture backend (e.g. domain layer, data-access layer OR ports&amp;adapters)
- [ ] add e2e tests
- [ ] (needs evaluation) refactor some operations to background jobs
- [ ] Observability: error tracking, APM, RUM, logs
- [ ] UX: confirmation modal when deleting a lead





**[p2]**

- [ ] improve agents seutup (e.g. glossary, changelog)
- [ ] eslint in backend
- [ ] refacto
- [ ] improve error handling (e.g. status codes)
- [ ] Compliance
  - [ ] PPI data in errors (/leads/generate-messages)
  - [ ] Strict ISO list. UK (should be GB) and XK (Kosovo, not an official ISO code) are rejected. One existing seed lead in dev.db (Emily Johnson) has UK. I didn't touch existing data; only new imports are checked.
  - [ ] (o be revisited on Feat2) Phone values are messy: so converting them all to one standard format (E.164) isn't reliable.



**[p3]**

- [ ] UX improvements
  - [ ] a live preview rendered against the first selected lead.
  - [ ] waiting... toast (in all operations)
  - [ ] sort &amp; hide columns &amp; save configuration
  - [ ] after verifying a failing email the toast is still green, also when they're not verified (i.e. workflow failed)