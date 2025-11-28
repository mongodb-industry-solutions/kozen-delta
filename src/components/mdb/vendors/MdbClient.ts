/**
 * @fileoverview MongoDB Secret Manager Service - MongoDB Implementation with Encryption Support
 * @author MDB SAT
 * @since 1.0.4
 * @version 1.0.6
 */

import { Collection, Db, MongoClient, MongoClientOptions } from "mongodb";
import { ILogger, IIoC } from "@kozen/engine";
import { IMdbClientOpt } from "./MdbClientOpt";
import AWS from 'aws-sdk';
import mdbOpt from '../configs/mdb.json';

/**
 * @class ReportManagerMDB
 * @extends ReportManager
 * MongoDB implementation with Client-Side Field Level Encryption (CSFLE) support
 */
export class MdbClient {
    protected assistant?: IIoC | null;

    /**
     * Logger service instance for recording service operations and errors
     * @type {ILogger | null}
     */
    public logger?: ILogger | null;

    /**
     * report manager configuration options
     * @protected
     * @type {IMdbCl | undefined}
     */
    protected _options?: IMdbClientOpt;

    /**
     * Gets the current report manager configuration options
     * @public
     * @readonly
     * @type {IMdbClientOpt}
     * @returns {IMdbClientOpt} The current report manager configuration
     * @throws {Error} When configuration is not initialized
     */
    get options(): IMdbClientOpt {
        return this._options!;
    }

    /**
     * MongoDB client instance used for database operations
     * @private
     * @type {MongoClient | null}
     */
    protected client: MongoClient | null = null;

    isConnected(): boolean {
        return this.client !== null;
    }
    /**
     * Initializes the MongoDB client and encryption settings.
     * @private
     * @param {IMdbClientOpt} [options] - MongoDB options for configuration.
     * @returns {Promise<MongoClient>} Promise resolving the MongoDB client instance.
     * @throws {Error} If MongoDB connection or encryption setup fails.
     */
    public async connect(options?: IMdbClientOpt, source?: Record<string, string>): Promise<MongoClient> {
        if (this.client) {
            return this.client;
        }
        const mdb = options || this.options || {} as IMdbClientOpt;
        const database = mdb.database || source?.database || process.env["MDB_DBNAME"];
        const collection = mdb.collection || source?.collection || process.env["MDB_COLLECTION"];

        mdb.uri = mdb.uri || source?.uri || process.env[mdb.uri as string] || process.env["MDB_URI"];
        mdb.database = process.env[database as string] || database;
        mdb.collection = process.env[collection as string] || collection;

        if (!mdb?.uri) {
            throw new Error("The MongoDB URI is required to initialize the MongoDB Secrets Manager.");
        }
        // Initialize MongoDB client if not done already
        if (!this.client) {
            const opt = this.loadOpts(mdb.options, source);
            if (opt.authMechanism === 'MONGODB-AWS') {
                // For AWS IAM, ensure we use the default credential provider chain
                AWS.config.update({
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '-',
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '-',
                    sessionToken: process.env.AWS_SESSION_TOKEN || '',
                    region: process.env.AWS_REGION || 'us-east-1'
                });
            }
            this.client = new MongoClient(mdb.uri, opt);
            await this.client.connect();
        }

        this._options = mdb;
        return this.client;
    }

    db(database?: string): Db {
        database = database || this.options.database;
        if (!database) {
            throw new Error("Database name must be specified in the request parameters or environment variables.");
        }
        if (!this.client) {
            throw new Error("MongoDB client is not connected. Call connect() first.");
        }
        return this.client.db(database);
    }

    collection(collection?: string, database?: string): Collection {
        collection = collection || this.options.collection;
        if (!collection) {
            throw new Error("Collection name must be specified in the request parameters or environment variables.");
        }
        return this.db(database).collection(collection);
    }

    transaction() {
        if (!this.client) {
            throw new Error("MongoDB client is not connected. Call connect() first.");
        }
        return this.client.startSession();
    }

    /**
     * Closes the active MongoDB connection and resets encryption context.
     * @public
     * @returns {Promise<void>} Promise resolving when cleanup is complete.
     */
    public async close(): Promise<void> {
        if (this.client) {
            await this.client.close();
            this.client = null;
        }
    }

    /**
     * Generates a MongoClientOptions object populated from environment variables
     * @returns {MongoClientOptions} The configuration options object.
     */
    public loadOpts(options?: MongoClientOptions, source?: Record<string, string>): MongoClientOptions {
        options = options || {};

        const mapL1: { [key: string]: string[] } = mdbOpt.l1;
        const mapL2: { [key: string]: string[] } = mdbOpt.l2;

        const extract = ([key, vals]: any) => {
            const envKey = vals[0];
            const optKey = vals[1] || key;
            const envValue = process.env[envKey];
            const optValue = source ? source[optKey] : undefined;
            const value = optValue || envValue;
            return { key, value: value ? this.castValue(value) as any : undefined };
        }

        Object.entries(mapL1).forEach(([index, vals]) => {
            const { key, value } = extract([index, vals]);
            value && (options[key as keyof MongoClientOptions] = value);
        });

        Object.entries(mapL2).forEach(([index, vals]) => {
            const { key, value } = extract([index, vals]);
            if (value && key) {
                const [parent, child] = key.split(".");
                const parentKey = parent as keyof MongoClientOptions;
                options[parentKey] = options[parentKey] || {} as any;
                (options[parentKey] as any)[child] = value;
            }
        });

        return options;
    }

    /**
     * Converts the value from the environment variable to the appropriate type based on its expected usage.
     * @param value The environment variable value.
     * @returns The value cast to the appropriate type.
     */
    private castValue(value: string): Boolean | Number | string {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (!isNaN(Number(value))) return Number(value);
        return value; // Default to string
    }
}

export default MdbClient;

export { MongoClient, Db, Collection } from "mongodb";