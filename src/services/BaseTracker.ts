import { Stats } from "fs";
import { IChange } from "../models/Change";
import { IRequest } from "../models/Request";
import { IResult } from "../models/Result";
import { ISource } from "../models/Source";
import { IFilter, IFilterFn } from "../models/Filter";
import { ITracker, ITrackerInfo } from "../models/Tracker";
import { readdir, stat } from "fs/promises";
import { join, parse, dirname, basename } from "path";
import { strToDate } from "@kozen/engine";

export abstract class BaseTracker implements ITracker {
    abstract configure(request: IRequest): Promise<ISource>;
    abstract add(changes: Array<IChange>, request?: IRequest): Promise<IResult>;
    abstract delete(changes: Array<IChange>, request?: IRequest): Promise<IResult>;
    abstract list(request?: IRequest): Promise<Array<IChange>>;
    protected abstract last(request?: IRequest): Promise<IChange>;

    /**
     * Extracts metadata from the target string.
     * @param target The target string to extract metadata from.
     * @returns An object containing the name and created date.
     */
    protected meta(target: string) {
        let parts = target.split('.');
        let created = strToDate(parts[0]);
        return {
            name: (!!created ? parts[1] : parts[0]) || '',
            created: created,
        }
    }

    /**
     * Validates if the file has the correct extension.
     * @param file The name of the file to validate.
     * @param path The path where the file is located.
     * @param request Optional request object containing validation parameters.
     * @returns True if the file is valid, false otherwise.
     */
    protected validate(file: string, path: string, request?: IRequest): boolean {
        return request?.extension && file.endsWith(`.${request.extension}`) || !request?.extension;
    }

    /**
     * Gets the stats of a file.
     * @param filePath The path of the file to get stats for
     * @param request Optional request object containing parameters for stat retrieval
     * @returns A promise that resolves to the file stats
     */
    protected async stat(filePath: string, request?: IRequest): Promise<Stats> {
        return request?.stat ? await stat(filePath) : { isFile: () => true } as Stats;
    }

    /**
     * Scans the specified directory for changes.
     * @param path The directory path to scan for changes
     * @param request Optional request object containing parameters for scanning
     * @returns A promise that resolves to an array of changes found in the directory
     */
    protected async scan(path: string, request?: IRequest, filter?: IFilterFn): Promise<{ available: Array<IChange>, missing: Array<IChange> }> {
        const available: Array<IChange> = [];
        const missing: Array<IChange> = [];
        request = request || {} as IRequest;
        try {
            const files = await readdir(path);
            for (const file of files) {
                const isValidExtension = this.validate(file, path, request);
                if (!isValidExtension) continue;
                const parsed = parse(file);
                const fileMeta = this.meta(parsed.name);
                const filePath = join(path, file);
                request.stat = fileMeta.created ? request?.stat : true;
                const fileStat = await this.stat(filePath, request);
                if (!fileStat.isFile()) continue;
                const change: IChange = {
                    name: fileMeta.name,
                    file: filePath,
                    path: dirname(filePath),
                    extension: parsed.ext.replace('.', ''),
                    created: fileMeta.created || fileStat.birthtime || undefined
                }
                const isValid = filter instanceof Function ? await filter(change) : true;
                isValid ? available.push(change) : missing.push(change);
            }
            // Sort by name (which includes timestamp) to ensure sequential order
            available.sort((a, b) => {
                const dateA = a.created ? new Date(a.created) : new Date(0);
                const dateB = b.created ? new Date(b.created) : new Date(0);
                return dateA.getTime() - dateB.getTime();
            });
        } catch (error) {
            console.error(`Error reading directory ${path}:`, error);
        }
        return { available, missing };
    }

    /**
     * Gets tracker information including last applied change, available changes, applied changes, and missing changes.
     * @param request Optional request object containing parameters for info retrieval
     * @returns A promise that resolves to the tracker information
     */
    public async info(request?: IRequest): Promise<ITrackerInfo> {
        const filter: IFilter = request?.filter || {};
        const path = request?.path || process.cwd();
        const last = await this.last(request);
        const { available: allFiles, missing: applied } = await this.scan(
            path,
            request,
            async (change: IChange) => {
                let answer = true;
                // Start with filtering by `created` relative to `last`
                if (last?.created) {
                    const changeCreated = change.created ? new Date(change.created) : null;
                    const appliedCreated = new Date(last.created);
                    answer = !!(changeCreated && changeCreated > appliedCreated);
                }
                // Apply name-based filtering if `filter.name` is provided
                if (filter.name) {
                    const regex = new RegExp(filter.name || '.*');
                    const doesMatch = regex.test(change.file || '');
                    answer = filter.type === 'exclude' ? !doesMatch : doesMatch;
                }
                return Promise.resolve(answer);
            }
        );
        // Limit the number of results if `filter.count` is defined
        const { first: available, second: ignored } = this.listSplit<IChange>(allFiles, filter.count || 0);

        return {
            filter,
            migrations: {
                last,
                available,
                applied,
                ignored,
                missing: []
            }
        }
    }

    /**
     * Gets the status of migrations.
     * @param request Optional request object containing parameters for status check
     * @returns A promise that resolves to the status result
     */
    public async status(request?: IRequest): Promise<IResult> {
        const content = await this.info(request);
        const applied = content.migrations?.applied || [];
        const last = content.migrations?.last || null;
        const [missing, available] = await Promise.all([
            this.missing(request, content),
            this.available(request, content)
        ]);
        return {
            success: true,
            message: "Status retrieved successfully",
            data: {
                filter: content.filter,
                migrations: {
                    last: basename(last?.file || ''),
                    applied: applied?.map(c => basename(c.file || '')),
                    missing: missing?.map(c => basename(c.file || '')),
                    ignored: content.migrations?.ignored?.map(c => basename(c.file || '')),
                    available: available?.map(c => basename(c.file || '')),
                }
            }
        };
    }

    /**
     * Gets the available changes based on the request parameters.
     * @param request Optional request object containing parameters for availability check
     * @returns A promise that resolves to an array of available changes
     */
    public async available(request?: IRequest, info?: ITrackerInfo): Promise<Array<IChange>> {
        const { migrations } = info || await this.info(request);
        return migrations?.available || [];
    }

    /**
     * Gets the missing changes that should have been applied.
     * @param request Optional request object containing parameters for missing check
     * @returns A promise that resolves to an array of missing changes
     */
    public async missing(request?: IRequest, info?: ITrackerInfo): Promise<Array<IChange>> {
        const { migrations } = info || await this.info(request);
        return migrations?.missing || [];
    }

    /**
     * Splits an array into chunks of a specified size.
     * @param list The original array to be split.
     * @param count The size of each chunk.
     * @returns An array of arrays, where each inner array is a chunk of the original array.
     */
    protected listSplit<T = any>(list: T[], count: number = 0): { first: T[]; second: T[] } {
        if (!count) {
            return { first: list, second: [] };
        }
        const first = list.slice(0, count);
        const second = list.slice(count);
        return { first, second };
    }
}