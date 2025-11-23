import { IIoC } from "@kozen/engine";

export interface ITool {
    assistant?: IIoC;
    flow?: string;
    options?: any;
}