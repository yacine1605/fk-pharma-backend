import * as schema from "./schema";
import postgres from "postgres";
export declare const db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
    $client: postgres.Sql<{}>;
};
//# sourceMappingURL=drizzle.d.ts.map