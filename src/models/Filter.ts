import { IChange } from "./Change";

export interface IFilter {
    id?: string;
    tag?: string;
    count?: number;
    created?: Date;
    name?: string;
    file?: string;
    type?: 'include' | 'exclude' | 'start' | 'stop';
}

export type IFilterFn = (item: IChange) => Promise<boolean>;