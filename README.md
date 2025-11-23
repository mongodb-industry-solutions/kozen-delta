# 🏠 Kozen Delta Module

### MongoDB Change Management Module

This module is designed to simplify the process of managing database changes in MongoDB for application developers. It allows developers to implement database migrations, track changes, and ensure consistency across environments in an efficient and developer-friendly way. Inspired by tools like Liquibase and Flyway, this module is optimized for MongoDB's NoSQL schema structure and built using modern technologies like Node.js and TypeScript to leverage a flexible, event-driven architecture.

---

### Key Concepts

The architecture revolves around **two main components**: **Tracker** and **Runner**.

#### **Tracker**
The Tracker is the persistence layer and service responsible for **logging** and **tracking the state of migrations**. It provides a centralized system for managing the history and status of all applied migrations. Additionally, the Tracker can work in **two modes**, ensuring flexibility in how logs and state are stored:
- **Internal Tracking Mode**:
  - The Tracker stores migration logs **inside the target MongoDB database** being managed. This is useful for situations where the team is comfortable with adding extra metadata collections to the database.
- **External Tracking Mode**:
  - The Tracker stores migration logs in **a separate database**. This mode is ideal for cases where the development team wants to ensure the target database remains isolated and stores only business-related data without any operational metadata.

**Managed Log for Migrations within Tracker:**
The migrations log is stored using a `migrations` collection. Each entry typically includes:
- **`id`**: Unique identifier of the migration (e.g., a timestamp-based ID or sequential number).
- **`description`**: A brief explanation of the migration’s purpose.
- **`status`**: Tracks whether a migration is pending, completed, or rolled back.
- **`appliedAt`**: Timestamp of when the migration was applied.
- **`rollbackAt`**: Timestamp of when a rollback was performed.
- **`targetDb`**: Reference to the target database (optional in External Tracking Mode).

Core responsibilities of the **Tracker** include:
1. **Logging Migration Status**:
    - Track applied or rolled-back migrations.
    - Provide metadata such as execution time and errors.
2. **Versioning**:
    - Prevent duplicate migrations and maintain execution sequence.
3. **Isolation**:
    - For external tracking, ensure logs are stored in a management database separate from the target database.

---

#### **Runner**
The Runner is the active component responsible for **execution of migrations**. It is the engine that applies changes to the target database. The Runner supports **Commit** and **Rollback actions**, enabling forward migrations as well as seamless rollbacks where necessary. 

**Key Features of the Runner:**
1. **Migration Types**:
   - **Schema Changes**: Create indexes, collections, documents, or modify schemas.
   - **Data Transformations**: Migrate/refactor existing data.
   - **Setup/Teardown**: Initialize database features or clean up older structures.
   - **Application-specific Migrations**: Custom changes for application-specific logic.
2. **Transaction Handling**:
   - The Runner handles transactions (when applicable, as MongoDB supports multi-document transactions within replica sets and sharded clusters).
   - It ensures either full success or full rollback, guaranteeing database integrity.
3. **Execution Modes**:
   - **Batch Execution**: Run multiple migrations in sequence to ensure all changes are applied in the order defined.
   - **Single Execution**: Execute a specific migration.
   - **Selective Rollbacks**: Target specific migrations for rollback based on identifiers or timestamps.
4. **Event-driven Execution**:
   - Logs migration events for troubleshooting and auditing.
   - Handle migration errors gracefully.

---

### Integration Workflow
The module works seamlessly by orchestrating actions between the Tracker and Runner:

1. **Load Migrations**:
   - Migrations are typically defined as individual TypeScript files, each exporting the migration logic (`up` and `down` functions).

2. **Tracker Initialization**:
   - The Tracker connects to the database where migration logs are stored.
   - For internal tracking, the Tracker initializes in the primary target database.
   - For external tracking, the Tracker connects to the separate management database.

3. **Migration Execution (Runner)**:
   - The Runner scans migration files and checks with the Tracker for migrations that need to be applied or rolled back.
   - The Runner applies migrations sequentially, updating the Tracker after each successful commit or rollback.

4. **Audit and Monitoring**:
   - The Tracker stores all migration-related events for auditing purposes.
   - Reporting tools can be used to query migration status, timestamps, and detailed logs.

---

### Migration File Structure
To ensure developer-friendliness, migrations are defined as TypeScript files, with the following structure:

```typescript
import { Db } from "mongodb";

export default {
    id: "202310152245_create_users_collection", // Unique identifier
    description: "Create the users collection and indexes.",
    commit: async ({ db } : { db: Db, assistant: IIoC }) => {
        // Logic to apply the migration
        await db.createCollection("users");
        await db.collection("users").createIndex({ email: 1 }, { unique: true });
    },
    rollback: async ({ db } : { db: Db, assistant: IIoC }) => {
        // Logic to roll back the migration
        await db.collection("users").drop();
    },
};
```

---

---

### Advantages

**Flexible Migration Management**:
- Offers freedom to developers to design changes anywhere from schema definition to data transformation without being locked into generic constraints.

**Isolated Logging**:
- With support for external tracking, developers can store tracking data outside the target database to maintain separation of logic.

**Type Safety**:
- TypeScript ensures strong typing for migrations, reducing runtime errors and simplifying refactoring.

**Seamless Workflow**:
- Easily integrate migrations into CI/CD pipelines.
- Supports rollback in case of migration failures.

---

### CLI for Interaction
Add CLI commands for managing migrations (e.g., `up` for applying migrations or `down` for rolling them back). These commands can be triggered via Node.js scripts.

```bash
# Apply all pending migrations
npx kozen --moduleLoad=@kozen/delta --action=delta:commint --path=./migrations/ --runner=mdb --tracker=mdb

# Rollback the last applied migration
npx kozen --moduleLoad=@kozen/delta --action=delta:rollback --path=./migrations/ --runner=mdb --tracker=mdb
```

---

### Add Features
1. **Automatic Backup**:
   - Before applying migrations, take a snapshot of the database state for eventual recovery.
2. **Dynamic Configuration**:
   - Allow configuration via environment variables (e.g., `MIGRATIONS_DB_URI` for tracker database URI).
3. **Hooks**:
   - Pre/Post migration hooks for custom business logic.
4. **Concurrency Controls**:
   - Prevent simultaneous migration executions.

This module empowers developers to manage database migrations in MongoDB in a way that mirrors what Liquibase/Flyway offers for SQL databases but tailored for MongoDB and TypeScript. Let me know if you'd like me to help with the actual implementation! 😊

## References
- [Kozen Triggers Full Documentation](https://github.com/mongodb-industry-solutions/kozen-trigger/wiki)
- [Kozen Triggers through DeepWiki](https://deepwiki.com/mongodb-industry-solutions/kozen-trigger/1-overview)
- [Disclaimer and Usage Policy](https://github.com/mongodb-industry-solutions/kozen-engine/wiki/POLICY)
- [How to Contribute to Kozen Ecosystem](https://github.com/mongodb-industry-solutions/kozen-engine/wiki/Contribute)
- [Official Kozen Documentation](https://github.com/mongodb-industry-solutions/kozen-engine/wiki)

---

← Previous: [Home](https://github.com/mongodb-industry-solutions/kozen-trigger/wiki) | Next: [Get-Started](https://github.com/mongodb-industry-solutions/kozen-trigger/wiki/Get-Started) →