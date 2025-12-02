import { IRunner } from "./Runner";
import { ITracker } from "./Tracker";

export interface IMigrator extends ITracker, IRunner { }