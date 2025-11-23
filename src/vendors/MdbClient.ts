/**
 * @fileoverview MongoDB Secret Manager Service - MongoDB Implementation with Encryption Support
 * @author MDB SAT
 * @since 1.0.4
 * @version 1.0.6
 */

import { MongoClient, MongoClientOptions } from "mongodb";
import { ILogger, IIoC } from "@kozen/engine";
import { IMdbClientOpts } from "./MdbClientOpt";
import AWS from 'aws-sdk';

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
    protected _options?: IMdbClientOpts;

    /**
     * Gets the current report manager configuration options
     * @public
     * @readonly
     * @type {IMdbClientOpt}
     * @returns {IMdbClientOpt} The current report manager configuration
     * @throws {Error} When configuration is not initialized
     */
    get options(): IMdbClientOpts {
        return this._options!;
    }

    /**
     * MongoDB client instance used for database operations
     * @private
     * @type {MongoClient | null}
     */
    protected client: MongoClient | null = null;


    /**
     * Initializes the MongoDB client and encryption settings.
     * @private
     * @param {IMdbClientOpt} [options] - MongoDB options for configuration.
     * @returns {Promise<MongoClient>} Promise resolving the MongoDB client instance.
     * @throws {Error} If MongoDB connection or encryption setup fails.
     */
    protected async connect(options?: IMdbClientOpts): Promise<MongoClient> {
        if (this.client) {
            return this.client;
        }
        const { mdb } = options || this.options;
        if (!mdb?.uri) {
            throw new Error("The MongoDB URI is required to initialize the MongoDB Secrets Manager.");
        }
        const uri = process.env[mdb.uri] as string;
        // Initialize MongoDB client if not done already
        if (!this.client) {
            const opt = this.loadOptsFromEnv(mdb.options);
            if (opt.authMechanism === 'MONGODB-AWS') {
                // For AWS IAM, ensure we use the default credential provider chain
                AWS.config.update({
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '-',
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '-',
                    sessionToken: process.env.AWS_SESSION_TOKEN || '',
                    region: process.env.AWS_REGION || 'us-east-1'
                });
            }
            this.client = new MongoClient(uri, opt);
            await this.client.connect();
        }
        return this.client;
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
    public loadOptsFromEnv(options?: MongoClientOptions): MongoClientOptions {
        options = options || {};

        // Mapping of environment variables to MongoClientOptions properties
        const envMapping: { [key: string]: string } = {
            MDB_REPLICA_SET: "replicaSet",
            MDB_TIMEOUT_MS: "timeoutMS",
            MDB_TLS: "tls",
            MDB_SSL: "ssl",
            MDB_TLS_CERTIFICATE_KEY_FILE: "tlsCertificateKeyFile",
            MDB_TLS_CERTIFICATE_KEY_FILE_PASSWORD: "tlsCertificateKeyFilePassword",
            MDB_TLS_CA_FILE: "tlsCAFile",
            MDB_TLS_CRL_FILE: "tlsCRLFile",
            MDB_TLS_ALLOW_INVALID_CERTIFICATES: "tlsAllowInvalidCertificates",
            MDB_TLS_ALLOW_INVALID_HOSTNAMES: "tlsAllowInvalidHostnames",
            MDB_TLS_INSECURE: "tlsInsecure",
            MDB_CONNECT_TIMEOUT_MS: "connectTimeoutMS",
            MDB_SOCKET_TIMEOUT_MS: "socketTimeoutMS",
            MDB_COMPRESSORS: "compressors",
            MDB_ZLIB_COMPRESSION_LEVEL: "zlibCompressionLevel",
            MDB_SRV_MAX_HOSTS: "srvMaxHosts",
            MDB_SRV_SERVICE_NAME: "srvServiceName",
            MDB_MAX_POOL_SIZE: "maxPoolSize",
            MDB_MIN_POOL_SIZE: "minPoolSize",
            MDB_MAX_CONNECTING: "maxConnecting",
            MDB_MAX_IDLE_TIME_MS: "maxIdleTimeMS",
            MDB_WAIT_QUEUE_TIMEOUT_MS: "waitQueueTimeoutMS",
            MDB_READ_CONCERN_LEVEL: "readConcernLevel",
            MDB_READ_PREFERENCE: "readPreference",
            MDB_AUTH_MECHANISM: "authMechanism",
            MDB_AUTH_SOURCE: "authSource",
            MDB_USERNAME: "auth.username",
            MDB_PASSWORD: "auth.password",
            MDB_WRITE_CONCERN_W: "writeConcern.w",
            MDB_WRITE_CONCERN_JOURNAL: "writeConcern.journal",
            MDB_WRITE_CONCERN_WTIMEOUT_MS: "writeConcern.wtimeoutMS"
        };

        // Iterate over environment variables and map them to options
        Object.entries(envMapping).forEach(([envKey, optionKey]) => {
            const envValue = process.env[envKey];
            if (envValue !== undefined) {
                // If the option is nested, assign child properties
                if (optionKey.includes(".")) {
                    const [parent, child] = optionKey.split(".");
                    const parentKey = parent as keyof MongoClientOptions;
                    options[parentKey] = options[parentKey] || {} as any;
                    (options[parentKey] as any)[child] = this.castEnvValue(envValue);
                } else {
                    options[optionKey as keyof MongoClientOptions] = this.castEnvValue(envValue) as any;
                }
            }
        });

        return options;
    }

    /**
     * Converts the value from the environment variable to the appropriate type based on its expected usage.
     * @param value The environment variable value.
     * @returns The value cast to the appropriate type.
     */
    private castEnvValue(value: string): Boolean | Number | string {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (!isNaN(Number(value))) return Number(value);
        return value; // Default to string
    }
}

export default MdbClient;
