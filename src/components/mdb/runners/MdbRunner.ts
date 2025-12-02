
import { writeFile, readFile } from "fs/promises";
import { join } from "path";
import { IChange } from "../../../models/Change";
import { IRequest } from "../../../models/Request";
import { IResult } from "../../../models/Result";
import { ISource } from "../../../models/Source";
import { IMigration } from "../../../models/Migration";
import { MdbClient } from "../vendors/MdbClient";
import { BaseRunner } from "../../../services/BaseRunner";

export class MdbRunner extends BaseRunner {

    private client!: MdbClient;

    public async create(request?: IRequest): Promise<IResult> {
        const req = request || {} as IRequest;
        const name = req.params?.name || "migration";
        const env = req.params?.env || "dev";
        const path = req.path || process.cwd();

        const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
        const fileName = `${timestamp}-${env}-${name}.ts`;

        try {
            // Read template
            const templatePath = join(__dirname, '../../templates/mdb');
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

    public async configure(request: IRequest): Promise<ISource> {
        if (this.client?.isConnected()) {
            return {};
        }
        this.client = this.client || new MdbClient();
        await this.client.connect({}, request.params);
        return {};
    }

    public async compare(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }

    public async check(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }

    protected async runModule<T = IMigration>(options: IChange, action: string): Promise<IChange> {
        let result = null;
        let error = null;
        const session = this.client.transaction();
        try {
            // Start the transaction within the session
            session.startTransaction();
            // Execute the migration module's commit method
            const data = await super.runModule(
                options,
                action,
                [{
                    db: this.client.db(),
                    coll: this.client.coll({ session }),
                    collection: this.client.collection(),
                    assistant: this.assistant,
                    client: this.client,
                    session
                }]
            );
            result = data;
            // Commit the transaction
            await session.commitTransaction();
        } catch (err) {
            // Roll back changes
            await session.abortTransaction();
            error = err;
        } finally {
            session.endSession();
            if (error) {
                throw error;
            }
            return result as IChange;
        }
    }
}