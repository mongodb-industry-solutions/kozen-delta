
import { writeFile, readFile } from "fs/promises";
import { join } from "path";
import { IChange } from "../../../models/Change";
import { IRequest } from "../../../models/Request";
import { IResult } from "../../../models/Result";
import { ISource } from "../../../models/Source";
import { MdbClient } from "../vendors/MdbClient";
import { BaseRunner } from "../../../services/BaseRunner";
import { IModuleType } from "@kozen/engine";

export class MdbRunner extends BaseRunner {

    private client!: MdbClient;

    async create(request?: IRequest): Promise<IResult> {
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

    async configure(request: IRequest): Promise<ISource> {
        if (this.client?.isConnected()) {
            return {};
        }
        this.client = this.client || new MdbClient();
        await this.client.connect({}, request.params);
        return {};
    }

    async commit(change: IChange, request?: IRequest): Promise<IResult> {
        if (!this.client?.isConnected()) await this.configure(request || {});

        try {
            if (change.type !== 'module') {
                return { success: false, message: "Only 'module' type changes are supported for commit." };
            } else {
                const result = await this.runModule({
                    file: change.file || "",
                    key: (process.env.KOZEN_DELTA_KEY || 'delta:migration:') + (change.id || ''),
                    type: 'instance',
                    moduleType: process.env.KOZEN_DELTA_MIGRATION_TYPE as IModuleType
                }, 'commit', [{ db: this.client.db(), collection: this.client.collection(), assistant: this.assistant }]);
                return { success: true, message: "Migration committed", data: result };
            }
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async rollback(change: IChange, request?: IRequest): Promise<IResult> {
        if (!this.client?.isConnected()) await this.configure(request || {});
        if (!change.path) return { success: false, message: "Change path is missing" };

        try {
            const migration = await import(change.path);
            const migrationObj = migration.default || migration;

            if (migrationObj.rollback) {
                await migrationObj.rollback({
                    db: this.client.db(),
                    collection: this.client.collection(),
                    assistant: this.assistant
                });
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