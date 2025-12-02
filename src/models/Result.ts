export interface IResult<T = any> {
    success: boolean;
    message?: string;
    data?: T;
}