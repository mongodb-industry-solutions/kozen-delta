import { IResult } from "./Result";
import { ISource } from "./Source";
import { IRequest } from "./Request";
import { IChange } from "./Change";

export interface IRunner {
    commit(change: IChange, request?: IRequest): Promise<IResult>;
    rollback(change: IChange, request?: IRequest): Promise<IResult>;
    configure(request: IRequest): Promise<ISource>;

    /**
     * compare to databases to find differeces
     * @param request
     */
    compare(request?: IRequest): Promise<IResult>;

    /**
     * Check errors in the migration file
     * @param request 
     */
    check(request?: IRequest): Promise<IResult>;

    /**
     * Create a migration file as example
     * @param request
     */
    create(request?: IRequest): Promise<IResult>;
}