import { BinRunner } from "./BinRunner";
import { IRequest } from "@/models/Request";
import { ISource } from "@/models/Source";

export class MshRunner extends BinRunner {
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
