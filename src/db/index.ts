import { createRxDatabase, RxDatabase, addRxPlugin } from "rxdb/plugins/core";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { usersSchema } from "./users.schema";
import { plansSchema } from "./plans.schema";
import { tasksSchema } from "./tasks.schema";

if (import.meta.env.NODE_ENV !== "production") {
    addRxPlugin(RxDBUpdatePlugin);
    addRxPlugin(RxDBDevModePlugin);
}

let dbPromise: Promise<RxDatabase> | null = null;

export const initDB = async (): Promise<RxDatabase> => {
    if (!dbPromise) {
        dbPromise = (async () => {
            try {
                const db = await createRxDatabase({
                    name: "constructiondb",
                    storage: wrappedValidateAjvStorage({
                        storage: getRxStorageDexie(),
                    }),
                    closeDuplicates: true,
                    eventReduce: true,
                    allowSlowCount: false,
                });

                await db.addCollections({
                    users: { schema: usersSchema },
                    plans: { schema: plansSchema },
                    tasks: { schema: tasksSchema },
                });

                return db;
            } catch (err) {
                dbPromise = null;
                console.error("Failed to initialize RxDB:", err);
                throw err;
            }
        })();
    }
    return dbPromise;
};

export type UserDB = RxDatabase<{
    tasks: { schema: typeof tasksSchema };
    plans: { schema: typeof plansSchema };
}>;
