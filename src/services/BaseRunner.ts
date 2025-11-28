import { IChange } from "../models/Change";
import { IMigration } from "../models/Migration";
import { IRequest } from "../models/Request";
import { IResult } from "../models/Result";
import { IRunner } from "../models/Runner";
import { ISource } from "../models/Source";
import { IDependency, IIoC, ILogger, IModuleType } from "@kozen/engine";
import { promises as fs } from 'node:fs';

export abstract class BaseRunner implements IRunner {

    public assistant: IIoC;
    public logger: ILogger;

    constructor({ assistant, logger }: { assistant: IIoC; logger: ILogger }) {
        this.assistant = assistant;
        this.logger = logger;
    }

    abstract commit(change: IChange, request?: IRequest): Promise<IResult>;
    abstract rollback(change: IChange, request?: IRequest): Promise<IResult>;
    abstract configure(request: IRequest): Promise<ISource>;
    abstract compare(request?: IRequest): Promise<IResult>;
    abstract check(change: IChange, request?: IRequest): Promise<IResult>;
    abstract create(request?: IRequest): Promise<IResult>;

    /**
     * Runs a migration module's specified action.
     * @param {IDependency} options - The dependency options to retrieve the migration module.
     * @param {string} action - The action method name to invoke on the migration module.
     * @param {any[]} params - Parameters to pass to the migration module's action.
     * @returns {Promise<H>} The result of the migration module's action.
     */
    protected async runModule<T = IMigration, H = void>(options: IDependency, action: string, params: any[] = []): Promise<H> {
        const module = await this.assistant.get<T>(options);
        const method = (module as any)[action];
        if (typeof method === 'function') {
            return await method.apply(module, params) as H;
        } else {
            throw new Error(`Method ${action} not found on migration module`);
        }
    }

    /**
     * Converts a change object to a dependency object.
     * @param {IChange} change - The change object to convert.
     * @returns {IDependency} The corresponding dependency object.
     */
    protected fromChange(change: IChange): IDependency {
        return {
            key: (process.env.KOZEN_DELTA_KEY || 'delta:migration:') + (change.name || ''),
            file: change.file || "",
            type: 'instance',
            moduleType: process.env.KOZEN_DELTA_MIGRATION_TYPE as IModuleType
        }
    }

    /**
     * Reads the content of a file asynchronously.
     * @param filePath - The path of the file to read.
     * @returns A promise that resolves to the file content as a string.
     */
    protected async getFileContent(filePath: string, format: BufferEncoding = 'utf-8', avoid: boolean = true): Promise<string> {
        try {
            return await fs.readFile(filePath, format);
        } catch (error) {
            if (avoid) {
                return '';
            }
            throw error;
        }
    }
}