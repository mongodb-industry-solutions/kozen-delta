import { IChange } from "../models/Change";
import { IMigration } from "../models/Migration";
import { IRequest } from "../models/Request";
import { IResult } from "../models/Result";
import { IRunner } from "../models/Runner";
import { ISource } from "../models/Source";
import { IDependency, IIoC, ILogger, IModuleType } from "@kozen/engine";
import { promises as fs } from 'node:fs';

export abstract class BaseRunner implements IRunner {

    /**
     * The IoC assistant for dependency management.
     */
    public assistant: IIoC;

    /**
     * The logger for logging messages.
     */
    public logger: ILogger;

    /**
     * Constructs a new BaseRunner instance.
     * @param options The options for initializing the BaseRunner.
     */
    constructor({ assistant, logger }: { assistant: IIoC; logger: ILogger }) {
        this.assistant = assistant;
        this.logger = logger;
    }

    /**
     * Configures the runner with the given request.
     * @param request Optional request parameters.
     */
    abstract configure(request: IRequest): Promise<ISource>;

    /**
     * Compares the current state with the desired state.
     * @param request Optional request parameters.
     */
    abstract compare(request?: IRequest): Promise<IResult>;

    /**
     * Checks if a change can be applied.
     * @param change The change to check.
     * @param request Optional request parameters.
     */
    abstract check(change: IChange, request?: IRequest): Promise<IResult>;

    /**
     * Creates a new migration file.
     * @param request Optional request parameters.
     */
    abstract create(request?: IRequest): Promise<IResult>;

    /**
     * Commits a change.
     * @param change The change to commit.
     * @param request Optional request parameters.
     * @returns The result of the commit operation.
     */
    public async commit(change: IChange, request?: IRequest): Promise<IResult> {
        await this.configure(request || {});
        if (change.type !== undefined && change.type !== 'module') {
            return { success: false, message: "Only 'module' type changes are supported for commit." };
        } else {
            try {
                const data = await this.runModule(change, 'commit');
                return { success: true, message: "Migration committed", data };
            } catch (error: any) {
                return { success: false, message: error.message };
            }
        }
    }

    /**
     * Rolls back a committed change.
     * @param change The change to roll back.
     * @param request Optional request parameters.
     * @returns The result of the rollback operation.
     */
    public async rollback(change: IChange, request?: IRequest): Promise<IResult> {
        await this.configure(request || {});
        if (change.type !== 'module') {
            return { success: false, message: "Only 'module' type changes are supported for rollback." };
        } else {
            try {
                const data = await this.runModule(change, 'rollback');
                return { success: true, message: "Migration rolled back", data };
            } catch (error: any) {
                return { success: false, message: error.message };
            }
        }
    }
    /**
     * Runs a migration module's specified action.
     * @param {IDependency} options - The dependency options to retrieve the migration module.
     * @param {string} action - The action method name to invoke on the migration module.
     * @param {any[]} params - Parameters to pass to the migration module's action.
     * @returns {Promise<H>} The result of the migration module's action.
     */
    protected async runModule<T = IMigration>(options: IChange, action: string, params: any[] = []): Promise<IChange> {
        const dep: IDependency = this.fromChange(options);
        const module = await this.assistant.get<T>(dep) as IMigration;
        if (!module) {
            throw new Error(`Migration module not found for change: ${options.name}: ${dep.file}`);
        }
        const method = (module as any)[action];
        if (typeof method === 'function') {
            const data = await method.apply(module, params) as IResult;
            options.description = data?.message || module.description;
            options.tags = [...(options.tags || []), ...(module.tags || [])];
            return options;
        } else {
            throw new Error(`Method ${action} not found on migration module`);
        }
    }

    /**
     * Reads the content of a file asynchronously.
     * @param {IChange} change - The change object containing the file path.
     * @param {Object} options - Options for reading the file.
     * @param {BufferEncoding} [options.format='utf-8'] - The encoding format to use when reading the file.
     * @param {boolean} [options.avoid=true] - Whether to avoid throwing an error if the file cannot be read.
     * @returns The content of the file as a string, or an empty string if avoid is true and an error occurs.
     */
    async getContent(change: IChange, { format = 'utf-8', avoid = true }: { format?: BufferEncoding; avoid?: boolean } = {}): Promise<string> {
        try {
            if (!change.file) {
                throw new Error("No file specified in change options");
            }
            return await fs.readFile(change.file, format);
        } catch (error) {
            if (avoid) {
                return '';
            }
            throw error;
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
            raw: false,
            moduleType: (process.env.KOZEN_DELTA_MIGRATION_TYPE as IModuleType) || (change.type === undefined || change.type === 'module' ? 'module' : 'commonjs' as IModuleType)
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