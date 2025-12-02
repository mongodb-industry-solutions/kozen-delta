import { IChange } from "./Change";
import { IFilter } from "./Filter";
import { IRequest } from "./Request";
import { IResult } from "./Result";
import { ISource } from "./Source";

export interface ITracker {
    configure(request: IRequest): Promise<ISource>;

    /**
     * Add applied changes to the tracker
     * @param changes
     * @param request
     */
    add(changes: Array<IChange>, request?: IRequest): Promise<IResult>;

    /**
     * Delete applied changes from the tracker
     * @param changes
     * @param request
     */
    delete(changes: Array<IChange>, request?: IRequest): Promise<IResult>;

    /**
     * list all migrations files applied or not
     * @param request IRequest
     * @returns Promise<Array<IChange>>
     */
    list(request?: IRequest): Promise<Array<IChange>>;

    /**
     * Get the status of migrations
     * @param request IRequest
     * @returns Promise<IResult>
     */
    status(request?: IRequest): Promise<IResult>;

    /**
     * Get available migration files that are not yet applied
     * @param request IRequest
     * @returns Promise<Array<IChange>>
     */
    available(request: IRequest): Promise<Array<IChange>>;

    /**
     * Get missing migration files that were applied but are now missing
     * @param request IRequest
     * @returns Promise<Array<IChange>>
     */
    missing(request: IRequest): Promise<Array<IChange>>;
}

export interface ITrackerInfo {
    filter?: IFilter;
    migrations?: {
        last?: IChange | null;
        available?: Array<IChange>;
        applied?: Array<IChange>;
        missing?: Array<IChange>;
        ignored?: Array<IChange>;
    }
}