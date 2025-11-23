Step 1: Read README, models (Runner, Tracker, Request, Source, Change, Result), MigrationService, DeltaCLIController, existing runners/trackers, IoC configs, and MongoDB vendor utilities to understand current design and integration points.
Step 2: Create tmp directory and initialize steps log for tracking changes.
Step 3: Analyze how MigrationService expects runners/trackers to behave (list/add/delete/status/commit/rollback/compare/check) and how CLI fills IRequest to design runner/tracker APIs and file scanning behavior.
Step 4: Design BaseTracker (abstract) with async filesystem scanning for migrations, plus MdbTracker/SqliteTracker for persistence, and implement BinRunner, MshRunner, and MdbRunner to execute migrations according to their respective strategies.


