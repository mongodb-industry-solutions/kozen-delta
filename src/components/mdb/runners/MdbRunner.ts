
import { writeFile, readFile } from "fs/promises";
import { join } from "path";
import { IChange } from "../../../models/Change";
import { IRequest } from "../../../models/Request";
import { IResult } from "../../../models/Result";
import { ISource } from "../../../models/Source";
import { MdbClient } from "../vendors/MdbClient";
import { BaseRunner } from "../../../services/BaseRunner";
import { IDependency, IModuleType } from "@kozen/engine";
import { IMigration } from "@/models/Migration";

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

    public async commit(change: IChange, request?: IRequest): Promise<IResult> {
        if (!this.client?.isConnected()) await this.configure(request || {});
        if (change.type !== 'module') {
            return { success: false, message: "Only 'module' type changes are supported for commit." };
        } else {
            try {
                const dep: IDependency = {
                    key: (process.env.KOZEN_DELTA_KEY || 'delta:migration:') + (change.name || ''),
                    file: change.file || "",
                    type: 'instance',
                    moduleType: process.env.KOZEN_DELTA_MIGRATION_TYPE as IModuleType
                };
                const data = await this.runModule(dep, 'commit');
                return { success: true, message: "Migration committed", data };
            } catch (error: any) {
                return { success: false, message: error.message };
            }
        }
    }

    public async rollback(change: IChange, request?: IRequest): Promise<IResult> {
        if (!this.client?.isConnected()) await this.configure(request || {});
        if (change.type !== 'module') {
            return { success: false, message: "Only 'module' type changes are supported for rollback." };
        } else {
            try {
                const dep: IDependency = {
                    key: (process.env.KOZEN_DELTA_KEY || 'delta:migration:') + (change.name || ''),
                    file: change.file || "",
                    type: 'instance',
                    moduleType: process.env.KOZEN_DELTA_MIGRATION_TYPE as IModuleType
                };
                const data = await this.runModule(dep, 'rollback');
                return { success: true, message: "Migration rolled back", data };
            } catch (error: any) {
                return { success: false, message: error.message };
            }
        }
    }

    public async compare(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }

    public async check(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }

    protected async runModule<T = IMigration, H = void>(options: IDependency, action: string): Promise<H> {
        // protected async commitModule(change: IChange, request?: IRequest): Promise<IResult> {
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
                    collection: this.client.collection(),
                    assistant: this.assistant,
                    session
                }]
            );
            result = { success: true, message: "Migration committed", data };
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
            return result as unknown as H;
        }
    }
}