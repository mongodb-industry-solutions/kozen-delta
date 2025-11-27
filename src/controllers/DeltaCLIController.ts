/**
 * @fileoverview Controller for managing triggers via CLI
 * @author MongoDB Solution Assurance Team (SAT)
 * @since 1.1.0
 * @version 1.1.0
 */
import path from 'node:path';
import { CLIController, IArgs, IConfig, IModule } from '@kozen/engine';
import { IRunner } from '@/models/Runner';
import { IRequest } from '@/models/Request';

/**
 * @class DeltaCLIController
 * @extends CLIController
 * @description Controller class for managing triggers via CLI
 */
export class DeltaCLIController extends CLIController {

    /**
     * Rolls back the last applied change using the delta service.
     * @param {ITriggerOptions} options - Trigger options for initialization
     * @throws {Error} When trigger service initialization fails
     * @public
     */
    public async commit(options: IRequest): Promise<{ await: boolean }> {
        try {
            const migration = await this.assistant?.get<IRunner>('delta:service');
            options.flow = options.flow || this.getId(options as unknown as IConfig);
            await migration?.commit(options);
            return { await: true };
        } catch (error) {
            this.logger?.error({
                flow: this.getId(options as unknown as IConfig),
                src: 'Delta:Controller:Commit',
                message: `❌ Failed to commit change: ${(error as Error).message}`
            });
            return { await: false };
        }
    }

    /**
     * Rolls back the trigger service based on provided options.
     * @param {ITriggerOptions} options - Trigger options for initialization
     * @throws {Error} When trigger service initialization fails
     * @public
     */
    public async rollback(options: IRequest): Promise<{ await: boolean }> {
        try {
            const migration = await this.assistant?.get<IRunner>('delta:service');
            options.flow = options.flow || this.getId(options as unknown as IConfig);
            await migration?.rollback(options);
            return { await: true };
        } catch (error) {
            this.logger?.error({
                flow: this.getId(options as unknown as IConfig),
                src: 'Delta:Controller:Rollback',
                message: `❌ Failed to rollback change: ${(error as Error).message}`
            });
            return { await: false };
        }
    }

    /**`
     * Fills and validates CLI arguments for trigger operations.
     * @param {string[] | IArgs} args - Raw command line arguments array or pre-parsed arguments
     * @returns {Promise<IArgs>} Promise resolving to structured template arguments with defaults applied
     * @public
     */
    public async fill(args: string[] | IArgs): Promise<IArgs> {
        const {
            KOZEN_DELTA_RUNNER,
            KOZEN_DELTA_TRACKER,
            KOZEN_DELTA_PREFIX,
            KOZEN_DELTA_TAG,
            KOZEN_DELTA_PATH,
            KOZEN_DELTA_EXTENSION,
            KOZEN_DELTA_STAT,
            KOZEN_DELTA_FILTER_ID,
            KOZEN_DELTA_FILTER_COUNT,
            KOZEN_DELTA_FILTER_NAME,
            KOZEN_DELTA_FILTER_FILE,
            KOZEN_DELTA_FILTER_DATE,
            KOZEN_DELTA_FILTER_TYPE
        } = process.env;

        let params: Partial<IArgs> = this.extract(args);
        let parsed: IRequest = { params };

        parsed.filter = parsed.filter || {};
        (params.count || KOZEN_DELTA_FILTER_COUNT) && (parsed.filter.count = Number(params.count || KOZEN_DELTA_FILTER_COUNT));
        (params.filterId || KOZEN_DELTA_FILTER_ID) && (parsed.filter.id = params.filterId || KOZEN_DELTA_FILTER_ID);
        (params.filterName || KOZEN_DELTA_FILTER_NAME) && (parsed.filter.name = params.filterName || KOZEN_DELTA_FILTER_NAME);
        (params.filterFile || KOZEN_DELTA_FILTER_FILE) && (parsed.filter.file = params.filterFile || KOZEN_DELTA_FILTER_FILE);
        (params.filterDate || KOZEN_DELTA_FILTER_DATE) && (parsed.filter.date = new Date(params.filterDate || KOZEN_DELTA_FILTER_DATE as string));
        (params.filterType || KOZEN_DELTA_FILTER_TYPE) && (parsed.filter.type = params.filterType || KOZEN_DELTA_FILTER_TYPE);
        if (!Object.keys(parsed.filter).length) {
            parsed.filter.count = 1;
        }
        
        parsed.stat = params.stat || (KOZEN_DELTA_STAT === 'true');
        parsed.path = params.path || KOZEN_DELTA_PATH || process.cwd();
        parsed.extension = (params.extension || KOZEN_DELTA_EXTENSION || 'js').toLowerCase();
        parsed.runner = (params.runner || KOZEN_DELTA_RUNNER || 'mdb').toLowerCase();
        parsed.tracker = (params.tracker || KOZEN_DELTA_TRACKER || parsed.runner).toLowerCase();

        (params.prefix || KOZEN_DELTA_PREFIX) && (params.prefix = params.prefix || KOZEN_DELTA_PREFIX);
        (params.tag || KOZEN_DELTA_TAG) && (parsed.tag = params.tag || KOZEN_DELTA_TAG);

        return parsed as IArgs;
    }

    /**
     * Displays comprehensive CLI usage information for secret management operations
     * Shows available commands, options, and examples for the Secret Manager tool
     * 
     * @returns {void}
     * @public
     */
    public async help(): Promise<void> {
        const mod = await this.assistant?.get<IModule>('module:@kozen/delta');
        const dir = process.env.KOZEN_DOCS_DIR || path.resolve(__dirname, '../docs');
        const helpText = await this.srvFile?.select('trigger', dir);
        super.help({
            title: `'${mod?.metadata?.alias || 'Delta'}' from '${mod?.metadata?.name}' package`,
            body: helpText,
            version: mod?.metadata?.version,
            uri: mod?.metadata?.uri
        });
    }
}