import { IChange } from "@/models/Change";
import { IRequest } from "@/models/Request";
import { IResult } from "@/models/Result";
import { ISource } from "@/models/Source";
import { ITracker } from "@/models/Tracker";
import { readdir, stat } from "fs/promises";
import { join, parse } from "path";

export abstract class BaseTracker implements ITracker {
    abstract configure(request: IRequest): Promise<ISource>;

    abstract add(changes: Array<IChange>, request?: IRequest): Promise<IResult>;
    abstract delete(changes: Array<IChange>, request?: IRequest): Promise<IResult>;
    abstract list(request?: IRequest): Promise<Array<IChange>>;

    protected async scan(path: string): Promise<Array<IChange>> {
        const changes: Array<IChange> = [];
        try {
            const files = await readdir(path);
            for (const file of files) {
                const filePath = join(path, file);
                const fileStat = await stat(filePath);
                if (fileStat.isFile()) {
                    const parsed = parse(file);
                    // Basic validation of the filename format could go here if needed
                    // But for now we just list them all and let available/status filter
                    changes.push({
                        id: parsed.name,
                        name: parsed.name,
                        file: file,
                        path: filePath,
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
        const allFiles = await this.scan(path);
        const appliedChanges = await this.list(request);

        // If no changes applied, all are available
        if (appliedChanges.length === 0) {
            return allFiles;
        }

        // Sort applied changes by ID (timestamp) just in case
        appliedChanges.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
        const lastApplied = appliedChanges[appliedChanges.length - 1];

        // Filter files that are lexicographically greater than the last applied ID
        return allFiles.filter(change => (change.id || "") > (lastApplied.id || ""));
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