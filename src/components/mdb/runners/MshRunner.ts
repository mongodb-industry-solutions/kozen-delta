import { BinRunner } from "../../bin/runners/BinRunner";
import { IRequest } from "../../../models/Request";
import { ISource } from "../../../models/Source";
import { IResult } from "../../../models/Result";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";

export class MshRunner extends BinRunner {
    async create(request?: IRequest): Promise<IResult> {
        const req = request || {} as IRequest;
        const name = req.params?.name || "migration";
        const env = req.params?.env || "dev";
        const path = req.path || process.cwd();

        const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
        const commitFile = `${timestamp}-${env}-${name}-commit.js`;
        const rollbackFile = `${timestamp}-${env}-${name}-rollback.js`;

        try {
            // Read templates
            const templatePath = join(__dirname, '../../templates/msh');
            const commitTemplate = await readFile(join(templatePath, 'commit.js'), 'utf-8');
            const rollbackTemplate = await readFile(join(templatePath, 'rollback.js'), 'utf-8');

            await writeFile(join(path, commitFile), commitTemplate, { mode: 0o644 });
            await writeFile(join(path, rollbackFile), rollbackTemplate, { mode: 0o644 });

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
                message: "Failed to create migration files",
                data: error.message
            };
        }
    }
    async configure(request: IRequest): Promise<ISource> {
        const uri = request.params?.uri || process.env.MONGO_URI || "";
        // If uri is provided, we prepend it to the command arguments?
        // BinRunner executes `${program} "${filePath}"`
        // We want `mongosh "${uri}" "${filePath}"`

        // So we can set program to `mongosh "${uri}"`?
        // But wait, if uri has spaces or special chars, it needs quoting.
        // And BinRunner puts quotes around filePath.

        // Let's just set program to `mongosh` if no uri, or `mongosh "${uri}"` if uri.
        // But wait, BinRunner does `${this.program} "${filePath}"`.
        // If program is `mongosh "mongodb://..."`, then it becomes `mongosh "mongodb://..." "file"`.
        // That seems correct for mongosh.

        const program = uri ? `mongosh "${uri}"` : "mongosh";
        this.program = program;

        return {
            config: {
                program: this.program
            }
        };
    }
}
