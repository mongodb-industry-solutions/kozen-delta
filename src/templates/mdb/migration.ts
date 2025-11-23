import { Db } from "mongodb";

export class Migration {
    async commit(context: { db: Db, assistant: any }) {
        // Implementation
    }

    async rollback(context: { db: Db, assistant: any }) {
        // Implementation
    }
}
