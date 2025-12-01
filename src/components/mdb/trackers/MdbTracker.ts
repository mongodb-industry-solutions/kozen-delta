import { BaseTracker } from "../../../services/BaseTracker";
import { IChange } from "../../../models/Change";
import { IRequest } from "../../../models/Request";
import { IResult } from "../../../models/Result";
import { ISource } from "../../../models/Source";
import { MdbClient, MongoClient, Db, Collection } from "../vendors/MdbClient";

export class MdbTracker extends BaseTracker {
    private db!: Db;
    private mdb: MdbClient;
    private client!: MongoClient;
    private collection!: Collection;

    constructor() {
        super();
        this.mdb = new MdbClient();
    }

    async configure(request: IRequest): Promise<ISource> {
        if (this.client) {
            return {
                config: {
                    db: this.db,
                    client: this.client,
                    collection: this.collection
                }
            };
        }

        this.client = await this.mdb.connect({}, request.params);
        this.db = this.mdb.db();

        const collectionName = this.mdb.options.collection || "delta_migrations";
        const collections = await this.db.listCollections({ name: collectionName }).toArray();

        if (collections.length === 0) {
            await this.db.createCollection(collectionName);
            this.collection = this.db.collection(collectionName);
            await this.collection.createIndexes([
                { key: { date: -1 } },
                { key: { owner: 1 } },
                { key: { id: 1 }, unique: true }
            ]);
        } else {
            this.collection = this.mdb.collection(collectionName);
        }

        return {
            config: {
                db: this.db,
                client: this.client,
                collection: this.collection
            }
        };
    }

    async add(changes: Array<IChange>, request?: IRequest): Promise<IResult> {
        try {
            if (!this.collection) await this.configure(request || {});

            if (changes.length === 0) {
                return {
                    success: true,
                    message: "No changes to add",
                    data: []
                };
            }
            const result = await this.collection.insertMany(changes);
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
        return await this.collection
            .find({}, {
                projection: {
                    _id: 0,
                    name: 1,
                    file: 1,
                    path: 1,
                    extension: 1,
                    date: 1
                }
            })
            .toArray() as IChange[];
    }

    async last(request?: IRequest): Promise<IChange> {
        if (!this.collection) await this.configure(request || {});
        const res = await this.collection
            .find({})
            .sort({ date: -1 })
            .limit(1)
            .toArray();
        return res[0] as IChange;
    }
}
