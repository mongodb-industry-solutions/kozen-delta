import { IChange } from "./Change";
import { IRequest } from "./Request";
import { IResult } from "./Result";
import { ISource } from "./Source";

export interface ITracker {
    configure(request: IRequest): Promise<ISource>;

    add(changes: Array<IChange>, request?: IRequest): Promise<IResult>;
    delete(changes: Array<IChange>, request?: IRequest): Promise<IResult>;
    list(request?: IRequest): Promise<Array<IChange>>;
    status(request?: IRequest): Promise<IResult>;

    available(request: IRequest): Promise<Array<IChange>>;
    missing(request: IRequest): Promise<Array<IChange>>;
}