import path from "path";
import { IRequest } from "../models/Request";
import { IResult } from "../models/Result";
import { IRunner } from "../models/Runner";
import { ISource } from "../models/Source";
import { IMigrator } from "../models/Migrator";
import { ITracker } from "../models/Tracker";
import { BaseService } from "@kozen/engine";
import { IChange } from "@/models/Change";

export class MigrationService extends BaseService implements IMigrator {

    protected prefixRunner?: string = 'delta:runner';
    protected prefixTracker?: string = 'delta:tracker';

    async getDrivers(req: IRequest): Promise<{ runner: IRunner | null; tracker: ITracker | null; }> {
        const runnerKey = this.prefixRunner + ':' + (req.runner || 'mdb').toLowerCase();
        const trackerKey = this.prefixTracker + ':' + (req.tracker || 'mdb').toLowerCase();

        if (!this.assistant) {
            throw new Error('Assistant is not initialized');
        }

        const [tracker, runner] = await Promise.all([
            this.assistant.get<ITracker>(trackerKey),
            this.assistant.get<IRunner>(runnerKey)
        ]);
        return { runner, tracker };
    }

    async commit(req: IRequest): Promise<IResult> {
        try {
            const results = [];
            const valid = [];
            const { runner, tracker } = await this.getDrivers(req);
            const list = await tracker?.available(req) || [];
            for (const chg of list) {
                try {
                    const result = await runner?.commit(chg, req);
                    if (!result?.success) {
                        throw new Error(result?.message);
                    }
                    results.push(result.data);
                    chg.applied = new Date();
                    valid.push(chg);
                }
                catch (error) {
                    this.logger?.error({
                        flow: req.flow,
                        src: 'Delta:Migration:Commit',
                        message: `❌ Failed to commit change '${chg.name}': ${(error as Error).message}`,
                        data: chg
                    });
                    break;
                }
            }
            const awaited = await tracker?.add(valid, req);
            this.logger?.info({
                flow: req.flow,
                src: 'Delta:Migration:Commit',
                message: `✅ Successfully committed ${Object.keys(awaited?.data || {}).length || 0} changes.`,
                data: {
                    migrations: valid.map(c => path.basename(c.file || c.name || ''))
                }
            });
            return {
                success: true,
                message: 'Commit successful',
                data: results
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to commit change: ${(error as Error).message}`,
                data: null
            };
        }
    }

    async rollback(req: IRequest): Promise<IResult> {
        try {
            const results = [];
            const valid = [];
            const { runner, tracker } = await this.getDrivers(req);
            const list = await tracker?.list(req) || [];
            for (const chg of list) {
                try {
                    const result = await runner?.rollback(chg, req);
                    if (!result?.success) {
                        throw new Error(result?.message);
                    }
                    results.push(result.data);
                    valid.push(chg);
                }
                catch (error) {
                    this.logger?.error({
                        flow: req.flow,
                        src: 'Delta:Migration:Rollback',
                        message: `❌ Failed to rollback change ${chg.name}: ${(error as Error).message}`
                    });
                    break;
                }
            }
            const awaited = await tracker?.delete(valid, req);
            this.logger?.info({
                flow: req.flow,
                src: 'Delta:Migration:Rollback',
                message: `✅ Successfully committed ${Object.keys(awaited?.data || {}).length || 0} changes.`,
                data: {
                    migrations: valid.map(c => path.basename(c.file || c.name || ''))
                }
            });
            return {
                success: true,
                message: 'Rollback successful',
                data: results
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to rollback change: ${(error as Error).message}`,
                data: null
            };
        }
    }

    async create(req: IRequest): Promise<IResult> {
        try {
            const { runner } = await this.getDrivers(req);
            if (!runner) {
                throw new Error('Runner not available');
            }
            return await runner.create(req);
        } catch (error) {
            return {
                success: false,
                message: `Failed to compare sources: ${(error as Error).message}`,
                data: null
            };
        }
    }

    async compare(req: IRequest): Promise<IResult> {
        try {
            const { runner } = await this.getDrivers(req);
            if (!runner) {
                throw new Error('Runner not available');
            }
            return await runner.compare(req);
        } catch (error) {
            return {
                success: false,
                message: `Failed to compare sources: ${(error as Error).message}`,
                data: null
            };
        }
    }

    async status(req: IRequest): Promise<IResult> {
        try {
            const { tracker } = await this.getDrivers(req);
            if (!tracker) {
                throw new Error('Tracker not available');
            }
            return await tracker.status(req);
        } catch (error) {
            return {
                success: false,
                message: `Failed to get status: ${(error as Error).message}`,
                data: null
            };
        }
    }

    async check(req: IRequest): Promise<IResult> {
        try {
            const { runner } = await this.getDrivers(req);
            if (!runner) {
                throw new Error('Runner not available');
            }
            return await runner.check(req);
        } catch (error) {
            return {
                success: false,
                message: `Health check failed: ${(error as Error).message}`,
                data: null
            };
        }
    }

    async configure(request: IRequest): Promise<ISource> {
        try {
            throw new Error('Not implemented');
        } catch (error) {
            this.logger?.error({
                flow: request.flow,
                src: 'Delta:Migration:Configure',
                message: `❌ Failed to configure source: ${(error as Error).message}`
            });
            throw error;
        }
    }

    add(changes: Array<IChange>, request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }
    delete(changes: Array<IChange>, request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }
    list(request?: IRequest): Promise<Array<IChange>> {
        throw new Error("Method not implemented.");
    }
    available(request: IRequest): Promise<Array<IChange>> {
        throw new Error("Method not implemented.");
    }
    missing(request: IRequest): Promise<Array<IChange>> {
        throw new Error("Method not implemented.");
    }
}