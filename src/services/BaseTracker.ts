import { Stats } from "fs";
import { IChange } from "../models/Change";
import { IRequest } from "../models/Request";
import { IResult } from "../models/Result";
import { ISource } from "../models/Source";
import { ITracker } from "../models/Tracker";
import { readdir, stat } from "fs/promises";
import { join, parse } from "path";

export abstract class BaseTracker implements ITracker {
    abstract configure(request: IRequest): Promise<ISource>;
    abstract add(changes: Array<IChange>, request?: IRequest): Promise<IResult>;
    abstract delete(changes: Array<IChange>, request?: IRequest): Promise<IResult>;
    abstract list(request?: IRequest): Promise<Array<IChange>>;
    protected abstract last(request?: IRequest): Promise<IChange>;

    protected async scan(path: string, request?: IRequest): Promise<Array<IChange>> {
        const changes: Array<IChange> = [];
        try {
            const files = await readdir(path);
            for (const file of files) {
                const isValidExtension = request?.extension && file.endsWith(`.${request.extension}`) || !request?.extension;
                const filePath = join(path, file);
                const fileStat = request?.stat ? await stat(filePath) : { isFile: () => true } as Stats;
                if (fileStat.isFile() && isValidExtension) {
                    const parsed = parse(file);
                    changes.push({
                        name: parsed.name,
                        file: filePath,
                        path: parsed.dir,
                        extension: parsed.ext.replace('.', ''),
                        date: fileStat.mtime
                    });
                }
            }
            // Sort by name (which includes timestamp) to ensure sequential order
            changes.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        } catch (error) {
            console.error(`Error reading directory ${path}:`, error);
        }
        return changes;
    }

    async available(request: IRequest): Promise<Array<IChange>> {
        const path = request.path || process.cwd();
        const allFiles = await this.scan(path, request);
        const lastApplied = await this.last(request);
        return lastApplied ? allFiles.filter(change => change && (change.id || "") > (lastApplied.id || "")) : allFiles;
    }

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