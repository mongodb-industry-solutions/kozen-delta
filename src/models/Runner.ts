import { IResult } from "./Result";
import { ISource } from "./Source";
import { IRequest } from "./Request";
import { IChange } from "./Change";

export interface IRunner {
    commit(change: IChange, request?: IRequest): Promise<IResult>;
    rollback(change: IChange, request?: IRequest): Promise<IResult>;
    configure(request: IRequest): Promise<ISource>;
    compare(request?: IRequest): Promise<IResult>;
    check(request?: IRequest): Promise<IResult>;
}