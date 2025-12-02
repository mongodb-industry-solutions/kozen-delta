import { IIoC } from "@kozen/engine";

export interface ITool<T = any> {
    assistant?: IIoC;
    flow?: string;
    options?: T;
}