import { IChange } from "@/models/Change";
import { IRequest } from "@/models/Request";
import { IResult } from "@/models/Result";
import { IRunner } from "@/models/Runner";
import { ISource } from "@/models/Source";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";

const execAsync = promisify(exec);

export class BinRunner implements IRunner {

    protected program!: string;

    async create(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }

    async configure(request: IRequest): Promise<ISource> {
        this.program = request.params?.program || "echo";
        return {
            config: {
                program: this.program
            }
        };
    }

    async commit(change: IChange, request?: IRequest): Promise<IResult> {
        if (!this.program) await this.configure(request || {});

        // Ensure we are using the commit file
        let filePath = change.path;
        if (!filePath) return { success: false, message: "Change path is missing" };

        // If it's a bin runner, we execute the file.
        return this.execute(filePath);
    }

    async rollback(change: IChange, request?: IRequest): Promise<IResult> {
        if (!this.program) await this.configure(request || {});
        if (!change.path) return { success: false, message: "Change path is missing" };

        // Logic to find rollback file
        // Expects change.path to be the commit file or similar.
        // Replace .commit. with .rollback.
        let rollbackPath = change.path.replace('.commit.', '.rollback.');

        if (rollbackPath === change.path) {
            // Fallback or error if naming convention is strict?
            // For now, assume strict naming or that the user provided the rollback file path in a different way?
            // But the interface takes IChange which usually comes from the tracker list.
        }

        if (!existsSync(rollbackPath)) {
            return {
                success: false,
                message: `Rollback file not found: ${rollbackPath}`
            };
        }

        return this.execute(rollbackPath);
    }

    protected async execute(filePath: string): Promise<IResult> {
        try {
            const command = `${this.program} "${filePath}"`;
            const { stdout, stderr } = await execAsync(command);

            return {
                success: true,
                message: stdout,
                data: stderr
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message,
                data: error.stderr
            };
        }
    }

    async compare(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }

    async check(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }
}
