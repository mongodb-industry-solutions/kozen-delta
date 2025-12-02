import { IFilter } from "./Filter";

export type IDeltaAction = 'commit' | 'rollback' | 'status' | 'compare';

/**
 * @module models/Request
 * @description Defines the change request options for database migrations.
 */
export interface IRequest {
    flow?: string;
    tag?: string;
    path?: string;
    prefix?: string;
    extension?: string;
    runner?: string;
    tracker?: string;
    filter?: IFilter;
    params?: any;
    stat?: boolean;
    action?: IDeltaAction;
}