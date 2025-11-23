import { IChange } from "@/models/Change";
import { IRequest } from "@/models/Request";
import { IResult } from "@/models/Result";
import { IRunner } from "@/models/Runner";
import { ISource } from "@/models/Source";

export class MdbRunner implements IRunner {
    commit(change: IChange, request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }
    rollback(change: IChange, request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }
    configure(request: IRequest): Promise<ISource> {
        throw new Error("Method not implemented.");
    }
    compare(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }
    check(request?: IRequest): Promise<IResult> {
        throw new Error("Method not implemented.");
    }
}