import { Stats } from "fs";
import { IChange } from "../models/Change";
import { IRequest } from "../models/Request";
import { IResult } from "../models/Result";
import { ISource } from "../models/Source";
import { ITracker } from "../models/Tracker";
import { readdir, stat } from "fs/promises";
import { join, parse, dirname } from "path";
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
    protected async scan(path: string, request?: IRequest): Promise<Array<IChange>> {
        const changes: Array<IChange> = [];
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
                changes.push({
                    name: fileMeta.name,
                    file: filePath,
                    path: dirname(filePath),
                    extension: parsed.ext.replace('.', ''),
                    created: fileMeta.created || fileStat.birthtime || undefined
                });
            }
            // Sort by name (which includes timestamp) to ensure sequential order
            changes.sort((a, b) => {
                const dateA = a.created ? new Date(a.created) : new Date(0);
                const dateB = b.created ? new Date(b.created) : new Date(0);
                return dateA.getTime() - dateB.getTime();
            });
        } catch (error) {
            console.error(`Error reading directory ${path}:`, error);
        }
        return changes;
    }

    /**
     * Gets the available changes based on the request parameters.
     * @param request Optional request object containing parameters for availability check
     * @returns A promise that resolves to an array of available changes
     */
    async available(request: IRequest): Promise<Array<IChange>> {
        const path = request.path || process.cwd();
        const allFiles = await this.scan(path, request);
        const lastApplied = await this.last(request);
        const result = lastApplied ? allFiles.filter(change => change && (change.created || "") > (lastApplied.created || "")) : allFiles;
        return result;
    }

    /**
     * Gets the status of migrations.
     * @param request Optional request object containing parameters for status check
     * @returns A promise that resolves to the status result
     */
    async status(request?: IRequest): Promise<IResult> {
        const req = request || {} as IRequest;
        const path = req.path || process.cwd();

        const allFiles = await this.scan(path);
        const appliedChanges = await this.list(req);

        // Sort for consistent logic
        allFiles.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
        appliedChanges.sort((a, b) => (a.id || "").localeCompare(b.id || ""));

        const appliedIds = new Set(appliedChanges.map(c => c.id || ""));
        const lastApplied = appliedChanges.length > 0 ? appliedChanges[appliedChanges.length - 1] : null;

        const pending: Array<IChange> = [];
        const lost: Array<IChange> = [];

        if (lastApplied) {
            for (const file of allFiles) {
                if ((file.id || "") > (lastApplied.id || "")) {
                    pending.push(file);
                } else if (!appliedIds.has(file.id || "")) {
                    // It's older or equal to last applied, but not in the applied list
                    lost.push(file);
                }
            }
        } else {
            // Nothing applied, everything is pending
            pending.push(...allFiles);
        }

        return {
            success: true,
            message: "Status retrieved successfully",
            data: {
                applied: appliedChanges.length,
                last_applied: lastApplied,
                pending: pending.length,
                lost: lost.length,
                details: {
                    pending_files: pending.map(c => c.name),
                    lost_files: lost.map(c => c.name)
                }
            }
        };
    }

    /**
     * Gets the missing changes that should have been applied.
     * @param request Optional request object containing parameters for missing check
     * @returns A promise that resolves to an array of missing changes
     */
    async missing(request: IRequest): Promise<Array<IChange>> {
        const path = request.path || process.cwd();
        const allFiles = await this.scan(path);
        const appliedChanges = await this.list(request);

        if (appliedChanges.length === 0) {
            return [];
        }

        appliedChanges.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
        const lastApplied = appliedChanges[appliedChanges.length - 1];
        const appliedIds = new Set(appliedChanges.map(c => c.id || ""));

        // Filter files that are older or equal to last applied, but not in applied list
        return allFiles.filter(change =>
            (change.id || "") <= (lastApplied.id || "") &&
            !appliedIds.has(change.id || "")
        );
    }
}