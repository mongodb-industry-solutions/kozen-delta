
import { IResult } from "./Result";
import { ITool } from "./Tool";

export interface IMigration {
    commit(tools?: ITool): Promise<IResult | void>;
    rollback(tools?: ITool): Promise<IResult | void>;
}