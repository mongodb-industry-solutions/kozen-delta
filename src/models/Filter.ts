export interface IFilter {
    id?: string;
    tag?: string;
    count?: number;
    date?: Date;
    name?: string;
    file?: string;
    type?: 'include' | 'exclude' | 'start' | 'stop';
}