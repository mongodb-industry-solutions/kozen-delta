import { BaseTracker } from "./BaseTracker";
import { IChange } from "@/models/Change";
import { IRequest } from "@/models/Request";
import { IResult } from "@/models/Result";
import { ISource } from "@/models/Source";
import { MongoClient, Db, Collection } from "mongodb";
import { MdbClient } from "@/vendors/MdbClient";
import { IMdbClientOpts } from "@/vendors/MdbClientOpt";

class MdbClientHelper extends MdbClient {
    public async getClient(options: IMdbClientOpts): Promise<MongoClient> {
        return this.connect(options);
    }
}

export class MdbTracker extends BaseTracker {
    private mdbClientHelper: MdbClientHelper;
    private client!: MongoClient;
    private db!: Db;
    private collection!: Collection;
    private readonly COLLECTION_NAME = "migrations";

    constructor() {
        super();
        this.mdbClientHelper = new MdbClientHelper();
    }

    async configure(request: IRequest): Promise<ISource> {
        if (this.client) {
            return {
                config: {
                    client: this.client,
                    db: this.db
                }
            };
        }

        let uriEnvVar = "MONGO_URI";
        if (request.params?.uri) {
            if (request.params.uri.startsWith("mongodb")) {
                process.env["KOZEN_DELTA_TEMP_URI"] = request.params.uri;
                uriEnvVar = "KOZEN_DELTA_TEMP_URI";
            } else {
                uriEnvVar = request.params.uri;
            }
        }

        const dbName = request.params?.dbName || process.env.MONGO_DB_NAME || "test";

        const options: IMdbClientOpts = {
            mdb: {
                uri: uriEnvVar
            }
        };

        this.client = await this.mdbClientHelper.getClient(options);
        this.db = this.client.db(dbName);
        this.collection = this.db.collection(this.COLLECTION_NAME);

        return {
            config: {
                client: this.client,
                db: this.db
            }
        };
    }

    async add(changes: Array<IChange>, request?: IRequest): Promise<IResult> {
        try {
            if (!this.collection) await this.configure(request || {});

            const result = await this.collection.insertMany(changes.map(c => ({
                ...c,
                appliedAt: new Date()
            })));

            return {
                success: result.acknowledged,
                data: result.insertedIds
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    async delete(changes: Array<IChange>, request?: IRequest): Promise<IResult> {
        try {
            if (!this.collection) await this.configure(request || {});

            const ids = changes.map(c => c.id);
            const result = await this.collection.deleteMany({ id: { $in: ids } });

            return {
                success: result.acknowledged,
                data: result.deletedCount
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    async list(request?: IRequest): Promise<Array<IChange>> {
        if (!this.collection) await this.configure(request || {});

        const docs = await this.collection.find({}).toArray();
        return docs.map(doc => ({
            id: doc.id,
            name: doc.name,
            file: doc.file,
            path: doc.path,
            extension: doc.extension,
            date: doc.date,
            // Add other fields if necessary
        }));
    }

    async status(request?: IRequest): Promise<IResult> {
        try {
            if (!this.client) {
                return { success: false, message: "Not connected" };
            }
            // Simple ping
            await this.db.command({ ping: 1 });
            return { success: true, message: "Connected" };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }
}
