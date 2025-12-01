import { IConfig, IDependency, KzModule } from "@kozen/engine";
import cli from "./configs/cli.json";
import ioc from "./configs/ioc.json";
import drvBin from "./components/bin/configs/ioc.json";
import drvMdb from "./components/mdb/configs/ioc.json";
import drvSqlite from "./components/sqlite/configs/ioc.json";
import fs from 'fs';
import path from 'path';

export class DeltaModule extends KzModule {

    constructor(dependency?: any) {
        super(dependency);
        this.metadata.alias = 'delta';
        try {
            const pac = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));
            this.metadata.summary = pac.description;
            this.metadata.version = pac.version;
            this.metadata.author = pac.author;
            this.metadata.license = pac.license;
            this.metadata.name = pac.name;
            this.metadata.uri = pac.homepage;
        }
        catch (error) {
            this.assistant?.logger?.warn({
                src: 'Module:Delta',
                msg: `Failed to load package.json metadata: ${(error as Error).message}`
            });
        }
    }

    public register(config: IConfig | null, opts?: any): Promise<Record<string, IDependency> | null> {
        let dep: Record<string, any> = {};
        switch (config?.type) {
            case 'cli':
                dep = { ...ioc, ...drvMdb, ...drvSqlite, ...drvBin, ...cli };
                break;
            default:
                dep = { ...ioc, ...drvMdb, ...drvSqlite, ...drvBin };
                break;
        }
        dep = this.fix(dep);
        return Promise.resolve(dep as Record<string, IDependency>);
    }
}

export default DeltaModule;

export * from "./components/mdb";
export * from "./components/bin";
export * from "./components/sqlite";
export * from "./services/MigrationService";
export * from "./services/BaseRunner";
export * from "./services/BaseTracker";
export * from "./models/Change";
export * from "./models/Filter";
export * from "./models/Migration";
export * from "./models/Request";
export * from "./models/Result";
export * from "./models/Runner";
export * from "./models/Source";
export * from "./models/Tool";
export * from "./models/Tracker";
