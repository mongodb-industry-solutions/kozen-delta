
import { writeFile } from "fs/promises";
import { join } from "path";
import { timeToStr } from "@kozen/engine";

import { IRequest } from "../../../models/Request";
import { ISource } from "../../../models/Source";
import { IResult } from "../../../models/Result";
import { IChange } from "../../../models/Change";
import { IMigration } from "../../../models/Migration";
import { BaseRunner } from "../../../services/BaseRunner";
import { MdbClient } from "../vendors/MdbClient";

const { Mongosh } = require("@mongosh/shell-api");

export class MshRunner extends BaseRunner {
    private client?: MdbClient;
    protected shell?: typeof Mongosh;

    async compare(request?: IRequest): Promise<IResult> {
        try {
            // const req = request || {} as IRequest;
            // const source = req.source;
            // const target = req.target;

            // if (!source || !target) {
            //     return {
            //         success: false,
            //         message: "Source and target configurations required for comparison",
            //         data: null
            //     };
            // }

            // // Compare collections, indexes, and schema differences
            // const sourceCollections = await this.getCollections(source);
            // const targetCollections = await this.getCollections(target);

            // const changes: IChange[] = [];

            // // Find missing collections
            // sourceCollections.forEach(collection => {
            //     if (!targetCollections.includes(collection)) {
            //         changes.push({
            //             type: 'add',
            //             object: 'collection',
            //             name: collection,
            //             script: `db.createCollection('${collection}')`
            //         } as IChange);
            //     }
            // });

            return {
                success: true,
                // message: `Found ${changes.length} differences`,
                // data: changes
            };
        } catch (error: any) {
            return {
                success: false,
                message: "Failed to compare databases",
                data: error.message
            };
        }
    }

    check(change: IChange, request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }

    async create(request?: IRequest): Promise<IResult> {
        const req = request || {} as IRequest;
        const name = req.params?.name || "migration";
        const path = req.path || process.cwd();
        const timestamp = timeToStr();
        const commitFile = join(path, `${timestamp}.${name}.commit.js`);
        const rollbackFile = join(path, `${timestamp}.${name}.rollback.js`);
        try {
            // Read templates
            await Promise.all([
                writeFile(commitFile, '// Commit migration', { mode: 0o644 }),
                writeFile(rollbackFile, '// Rollback migration', { mode: 0o644 })
            ]);
            return {
                success: true,
                message: "Migration files created",
                data: {
                    commit: commitFile,
                    rollback: rollbackFile
                }
            };
        } catch (error: any) {
            return {
                success: false,
                message: "Failed to create migration files" + error.message,
                data: {
                    commitFile,
                    rollbackFile
                }
            };
        }
    }

    protected async runModule<T = IMigration>(options: IChange, action: string): Promise<IChange> {
        let content = await this.getContent(options);

        if (!content) {
            throw new Error(`Migration file is empty or not found for change: '${options.name}': '${options.file}'`);
        }

        const template = `
            const session = db.getMongo().startSession();
            session.startTransaction();
            
            try {
                ${content}
                session.commitTransaction();
            } catch (e) {
                console.error({
                    flow: '${options.flow}',
                    src: 'Delta:Runner:Msh',
                    message: 'Error executing migration: ' + e.message,
                    data: ${JSON.stringify(options)}
                });
                session.abortTransaction();
            }finally {
                session.endSession();
            }
        `;

        try {
            const output = await this.shell.run(template);
            this.logger?.info({
                flow: options.flow,
                src: 'Delta:Runner:Msh',
                message: `✅ Migration module ${options.name} executed successfully`,
                data: output
            });
            return options
        } catch (error) {
            this.logger?.error({
                flow: options.flow,
                src: 'Delta:Runner:Msh',
                message: `❌ Failed to run migration module ${options.name}: ${(error as Error).message}`
            });
            throw error;
        }
    }

    async configure(request: IRequest): Promise<ISource> {
        if (this.client?.isConnected()) {
            return {};
        }
        this.client = this.client || new MdbClient();
        await this.client.connect({}, request.params);
        this.shell = new Mongosh({ client: this.client.driver });
        return {};
    }
}
