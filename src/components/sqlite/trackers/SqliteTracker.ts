import { BaseTracker } from "../../../services/BaseTracker";
import { IChange } from "../../../models/Change";
import { IRequest } from "../../../models/Request";
import { IResult } from "../../../models/Result";
import { ISource } from "../../../models/Source";
import { Database } from "sqlite3";

export class SqliteTracker extends BaseTracker {
    async last(request?: IRequest): Promise<IChange> {
        if (!this.db) await this.configure(request || {});

        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM ${this.TABLE_NAME} ORDER BY appliedAt DESC LIMIT 1`;

            this.db.get(sql, (err: Error | null, row: any) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    reject(new Error("No changes found"));
                } else {
                    resolve({
                        id: row.id,
                        name: row.name,
                        file: row.file,
                        path: row.path,
                        extension: row.extension,
                        created: new Date(row.created)
                    });
                }
            });
        });
    }
    private db!: Database;
    private readonly TABLE_NAME = "migrations";

    async configure(request: IRequest): Promise<ISource> {
        const filename = request.params?.filename || ":memory:";

        return new Promise((resolve, reject) => {
            this.db = new Database(filename, (err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    this.initTable().then(() => {
                        resolve({
                            config: {
                                db: this.db
                            }
                        });
                    }).catch(reject);
                }
            });
        });
    }

    private initTable(): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
                id TEXT PRIMARY KEY,
                name TEXT,
                file TEXT,
                path TEXT,
                extension TEXT,
                appliedAt TEXT
            )`;
            this.db.run(sql, (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async add(changes: Array<IChange>, request?: IRequest): Promise<IResult> {
        if (!this.db) await this.configure(request || {});

        return new Promise((resolve) => {
            const stmt = this.db.prepare(`INSERT INTO ${this.TABLE_NAME} (id, name, file, path, extension, appliedAt) VALUES (?, ?, ?, ?, ?, ?)`);

            this.db.serialize(() => {
                this.db.run("BEGIN TRANSACTION");

                let errorOccurred = false;
                changes.forEach(change => {
                    stmt.run(change.id, change.name, change.file, change.path, change.extension, new Date().toISOString(), (err: Error | null) => {
                        if (err) errorOccurred = true;
                    });
                });

                stmt.finalize();

                if (errorOccurred) {
                    this.db.run("ROLLBACK");
                    resolve({ success: false, message: "Error inserting changes" });
                } else {
                    this.db.run("COMMIT");
                    resolve({ success: true, data: changes.map(c => c.id) });
                }
            });
        });
    }

    async delete(changes: Array<IChange>, request?: IRequest): Promise<IResult> {
        if (!this.db) await this.configure(request || {});

        return new Promise((resolve) => {
            const ids = changes.map(c => `'${c.id}'`).join(",");
            const sql = `DELETE FROM ${this.TABLE_NAME} WHERE id IN (${ids})`;

            this.db.run(sql, function (err: Error | null) {
                if (err) {
                    resolve({ success: false, message: err.message });
                } else {
                    resolve({ success: true, data: this.changes });
                }
            });
        });
    }

    async list(request?: IRequest): Promise<Array<IChange>> {
        if (!this.db) await this.configure(request || {});

        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM ${this.TABLE_NAME}`, (err: Error | null, rows: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map((row: any) => ({
                        id: row.id,
                        name: row.name,
                        file: row.file,
                        path: row.path,
                        extension: row.extension,
                        date: new Date(row.appliedAt)
                    })));
                }
            });
        });
    }
}
