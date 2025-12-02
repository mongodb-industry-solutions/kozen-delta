import { BaseTracker } from "../../../services/BaseTracker";
import { IChange } from "../../../models/Change";
import { IRequest } from "../../../models/Request";
import { IResult } from "../../../models/Result";
import { ISource } from "../../../models/Source";
import { ITrackerInfo } from "../../../models/Tracker";
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

    /**
     * Gets the name of the collection used for tracking.
     */
    public get collectionName(): string {
        return this.mdb.options.collection || "delta_migrations";
    }

    /**
     * Sets up the tracking collection in the database.
     * @returns The collection used for tracking.
     */
    async setup(): Promise<Collection> {
        const collectionName = this.collectionName;
        const collections = await this.db.listCollections({ name: collectionName }).toArray();
        if (collections.length === 0) {
            await this.db.createCollection(collectionName);
            this.collection = this.mdb.collection(collectionName);
            await this.collection.createIndexes([
                { key: { created: -1 } },
                { key: { owner: 1 } }
            ]);
        } else {
            this.collection = this.mdb.collection(collectionName);
        }
        if (!(this.collection instanceof Collection)) {
            throw new Error("Collection not properly initialized after setup.");
        }
        return this.collection;
    }
    /**
     * Configures the tracker with the given request.
     * @param request Optional request parameters.
     * @returns The source configuration.
     */
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
        await this.setup();
        return {
            config: {
                db: this.db,
                client: this.client,
                collection: this.collection
            }
        };
    }

    /**
     * Adds new changes to the tracker.
     * @param changes Array of changes to add.
     * @param request Optional request parameters.
     * @returns The result of the add operation.
     */
    async add(changes: Array<IChange>, request?: IRequest): Promise<IResult> {
        try {
            await this.configure(request || {});
            if (!Array.isArray(changes) || changes.length === 0) {
                return {
                    success: true,
                    message: "No changes to add",
                    data: []
                };
            }
            const result = await this.collection.insertMany(changes, { ordered: true });
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

    /**
     * Deletes applied changes from the tracker.
     * @param changes Array of changes to delete.
     * @param request Optional request parameters.
     * @returns The result of the delete operation.
     */
    async delete(changes: Array<IChange>, request?: IRequest): Promise<IResult> {
        try {
            await this.configure(request || {});
            // Map the `changes` array to `file` and `name` pairs for deletion
            const conditions = changes.map(c => ({ file: c.file, name: c.name }));

            // Perform deleteMany on the collection using `$or` to match any `file` and `name` pair
            const result = await this.collection.deleteMany({ $or: conditions });
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

    /**
     * Lists all applied changes.
     * @param request Optional request parameters.
     * @returns A promise that resolves to an array of applied changes.
     */
    async list(request?: IRequest): Promise<Array<IChange>> {
        await this.configure(request || {});
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

    /**
     * Gets the last applied change.
     * @param request Optional request parameters.
     * @returns The last applied change.
     */
    async last(request?: IRequest): Promise<IChange> {
        await this.configure(request || {});
        const res = await this.collection
            .find({})
            .sort({ created: -1 })
            .limit(1)
            .toArray();
        return res[0] as IChange;
    }

    /**
     * Validates if a file has a supported extension.
     * @param file The name of the file to validate.
     * @param path The path of the file.
     * @param request Optional request parameters.
     * @returns A boolean indicating whether the file is valid.
     */
    protected validate(file: string, path: string, request?: IRequest): boolean {
        const valid = file.endsWith('.js') || file.endsWith('.cjs') || file.endsWith('.mjs');
        return valid || (request?.extension && file.endsWith(`.${request.extension}`) || !request?.extension);
    }

    /**
     * Gets the missing changes that should have been applied.
     * @param request Optional request object containing parameters for missing check
     * @returns A promise that resolves to an array of missing changes
     */
    async missing(request?: IRequest, info?: ITrackerInfo): Promise<Array<IChange>> {
        // Configure the request (setup, authentication, etc.)
        await this.configure(request || {});

        // Get the info object containing `missing`, `last`, and any available data
        info = info || await this.info(request);
        const { last, applied } = info.migrations || {};

        // Ensure `last.created` is defined and valid for filtering
        const lastCreated = last?.created ? new Date(last.created) : null;

        // Build the query for efficient filtering
        const query: Record<string, any> = {};

        if (!applied || applied.length === 0) {
            return [];
        }

        // Exclude records where BOTH `file` AND `name` match `applied`
        query.$or = applied.map(({ file, name }) => ({ file, name }));

        // Check only for records created before or on the `last.created` date
        if (lastCreated) {
            query.created = { $lte: lastCreated };
        }

        // Use projection to limit the fields in the result
        const projection = { file: 1, name: 1, created: 1 };

        // Execute the query
        const result = await this.collection.find(query).project(projection).toArray();

        // Construct a Set of `file` and `name` pairs found in the collection for quick lookups
        const existingSet = new Set<string>(
            result.map(({ file, name }) => `${file}:${name}`)
        );

        // Find the items in `applied` that are NOT in the collection
        const missing = applied?.filter(({ file, name }) => {
            const key = `${file}:${name}`;
            return !existingSet.has(key); // Include items that are not in the collection
        });

        return missing as IChange[];
    }
}
