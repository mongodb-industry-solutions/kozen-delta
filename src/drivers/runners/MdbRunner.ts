import { IChange } from "@/models/Change";
import { IRequest } from "@/models/Request";
import { IResult } from "@/models/Result";
import { IRunner } from "@/models/Runner";
import { ISource } from "@/models/Source";
import { MongoClient, Db } from "mongodb";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";

export class MdbRunner implements IRunner {
    public assistant: any; // IIoC type not available in context, using any
    public logger: any;

    private client!: MongoClient;
    private db!: Db;

    async create(request?: IRequest): Promise<IResult> {
        const req = request || {} as IRequest;
        const name = req.params?.name || "migration";
        const env = req.params?.env || "dev";
        const path = req.path || process.cwd();

        const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
        const fileName = `${timestamp}-${env}-${name}.ts`;

        try {
            // Read template
            const templatePath = join(process.cwd(), 'docs', 'templates', 'mdb');
            const template = await readFile(join(templatePath, 'migration.ts'), 'utf-8');

            await writeFile(join(path, fileName), template, { mode: 0o644 });

            return {
                success: true,
                message: "Migration file created",
                data: {
                    file: fileName
                }
            };
        } catch (error: any) {
            return {
                success: false,
                message: "Failed to create migration file",
                data: error.message
            };
        }
    }

    async configure(request: IRequest): Promise<ISource> {
        const uri = request.params?.uri || process.env.MONGO_URI || "mongodb://localhost:27017";
        const dbName = request.params?.dbName || process.env.MONGO_DB_NAME || "test";

        this.client = new MongoClient(uri);
        await this.client.connect();
        this.db = this.client.db(dbName);

        return {
            config: {
                client: this.client,
                db: this.db
            }
        };
    }

    async commit(change: IChange, request?: IRequest): Promise<IResult> {
        if (!this.db) await this.configure(request || {});
        if (!change.path) return { success: false, message: "Change path is missing" };

        try {
            const migration = await import(change.path);
            const migrationObj = migration.default || migration;

            if (migrationObj.commit) {
                await migrationObj.commit({ db: this.db, assistant: this.assistant });
                return { success: true, message: "Migration committed" };
            } else {
                return { success: false, message: "Commit method not found in migration file" };
            }
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async rollback(change: IChange, request?: IRequest): Promise<IResult> {
        if (!this.db) await this.configure(request || {});
        if (!change.path) return { success: false, message: "Change path is missing" };

        try {
            const migration = await import(change.path);
            const migrationObj = migration.default || migration;

            if (migrationObj.rollback) {
                await migrationObj.rollback({ db: this.db, assistant: this.assistant });
                return { success: true, message: "Migration rolled back" };
            } else {
                return { success: false, message: "Rollback method not found in migration file" };
            }
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async compare(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }

    async check(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }
}