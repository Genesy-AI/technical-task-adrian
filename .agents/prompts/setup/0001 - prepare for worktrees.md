Prepare this project to be run separately in parallel worktrees. Extract all the needed configuration values (specially pointers to backing services, following the approach of 12-factor app).

Pay special attention to Temporal.io, I'm not familiar with it and I'm not sure if we could run multiple development servers in parallel, so it may be easier to have a separate queue per worktree. I've already installed the `temporal-developer` skill for you, but don't hesitate to check the official docs if you're on doubt.

We'll be working on Orca (https://orca.dev/) so make sure they work there. Test it with real worktrees during the implementation.

Before committing anything, show me your plans.