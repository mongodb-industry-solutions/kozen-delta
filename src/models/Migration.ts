
import { IResult } from "./Result";
import { ITool } from "./Tool";

export interface IMigration<T = ITool, H = IResult> {
    commit(tools?: T): Promise<H | void>;
    rollback(tools?: T): Promise<H | void>;
}