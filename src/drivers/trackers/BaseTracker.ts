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
    abstract status(request?: IRequest): Promise<IResult>;

    async available(request: IRequest): Promise<Array<IChange>> {
        const changes: Array<IChange> = [];
        const path = request.path || process.cwd();

        try {
            const files = await readdir(path);
            const filterText = request.filter?.tag || "";

            for (const file of files) {
                if (filterText && !file.includes(filterText)) {
                    continue;
                }

                const filePath = join(path, file);
                const fileStat = await stat(filePath);

                if (fileStat.isFile()) {
                    const parsed = parse(file);
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
        } catch (error) {
            console.error(`Error reading directory ${path}:`, error);
            // Return empty list or throw? Returning empty list seems safer for now, but maybe logging is enough.
        }

        return changes;
    }

    async missing(request: IRequest): Promise<Array<IChange>> {
        const availableChanges = await this.available(request);
        const appliedChanges = await this.list(request);

        const appliedIds = new Set(appliedChanges.map(c => c.id));

        return availableChanges.filter(change => !appliedIds.has(change.id));
    }
}