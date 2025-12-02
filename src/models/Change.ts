export type IChangeType = 'module' | 'script' | 'data' | 'schema' | 'other';

export interface IChange {
    flow?: string;
    id?: string;
    path?: string;
    name?: string;
    file?: string;
    owner?: string;
    type?: IChangeType;
    tags?: string[];
    extension?: string;
    content?: string;
    description?: string;
    created?: Date | string;
    applied?: Date | string;
}