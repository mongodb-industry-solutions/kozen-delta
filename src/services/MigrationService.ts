import { IChange } from "@/models/Change";
import { IRequest } from "@/models/Request";
import { IResult } from "@/models/Result";
import { IRunner } from "@/models/Runner";
import { ISource } from "@/models/Source";
import { ITracker } from "@/models/Tracker";
import { BaseService } from "@kozen/engine";

export class MigrationService extends BaseService implements IRunner {

    protected prefixRunner?: string = 'delta:runner';
    protected prefixTracker?: string = 'delta:tracker';

    async getDrivers(req: IRequest): Promise<{ runner: IRunner; tracker: ITracker; }> {
        const runnerKey = this.prefixRunner + (req.runner || 'mdb');
        const trackerKey = this.prefixTracker + (req.tracker || 'mdb');
        const [tracker, runner] = await Promise.all([
            this.getDelegate<ITracker>(trackerKey),
            this.getDelegate<IRunner>(runnerKey)
        ]);
        return { runner, tracker };
    }

    async commit(req: IRequest): Promise<IResult> {
        try {
            const results = [];
            const valid = [];
            const { runner, tracker } = await this.getDrivers(req);
            const list = await tracker.list(req);
            for (const chg of list) {
                try {
                    const result = await runner.commit(chg, req);
                    if (!result.success) {
                        throw new Error(result.message);
                    }
                    results.push(result.data);
                    valid.push(chg);
                }
                catch (error) {
                    this.logger?.error({
                        flow: req.flow,
                        src: 'Delta:Migration:Commit',
                        message: `❌ Failed to commit change ${chg.id}: ${(error as Error).message}`
                    });
                    break;
                }
            }
            await tracker.add(valid, req);
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
            const list = await tracker.list(req);
            for (const chg of list) {
                try {
                    const result = await runner.rollback(chg, req);
                    if (!result.success) {
                        throw new Error(result.message);
                    }
                    results.push(result.data);
                    valid.push(chg);
                }
                catch (error) {
                    this.logger?.error({
                        flow: req.flow,
                        src: 'Delta:Migration:Rollback',
                        message: `❌ Failed to rollback change ${chg.id}: ${(error as Error).message}`
                    });
                    break;
                }
            }
            await tracker.delete(valid, req);
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

    async compare(req: IRequest): Promise<IResult> {
        try {
            const { runner } = await this.getDrivers(req);
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
}