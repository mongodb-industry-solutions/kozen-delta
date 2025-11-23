export interface IChange {
    id?: string;
    tag?: string;
    path?: string;
    name?: string;
    file?: string;
    owner?: string;
    date?: Date | string;
    extension?: string;
    content?: string;
}