export type IChangeType = 'module' | 'script' | 'data' | 'schema' | 'other';

export interface IChange {
    id?: string;
    path?: string;
    name?: string;
    file?: string;
    owner?: string;
    type?: IChangeType;
    date?: Date | string;
    tags?: string[];
    extension?: string;
    content?: string;
    description?: string;
}