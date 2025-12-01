import { Abortable, Db, Document, RunCommandOptions } from "mongodb";

export interface Idb extends Db {
    runCommand(command: Document, options?: RunCommandOptions & Abortable): Promise<Document>;
}