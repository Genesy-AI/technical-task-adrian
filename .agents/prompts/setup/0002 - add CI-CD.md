This project lacks proper CI/CD. Add a ci.yml workflow for Github to add deterministic checks on the PR. 

At least they may include: build, lint, test.

Also, adopt conventional commits in this repo and enforce them. Enforce the format also in the PR names.

Update CLAUDE.md to adopt these practices: run ci.yml checks locally before pushing, respecting conventional commits.