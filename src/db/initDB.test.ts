import { initDB } from "../db";
import { createRxDatabase } from "rxdb/plugins/core";

jest.mock("rxdb/plugins/core", () => ({
    createRxDatabase: jest.fn(),
    addRxPlugin: jest.fn(),
}));

jest.mock("rxdb/plugins/storage-dexie", () => ({
    getRxStorageDexie: jest.fn(() => ({})),
}));

jest.mock("rxdb/plugins/validate-ajv", () => ({
    wrappedValidateAjvStorage: jest.fn((opts) => opts.storage),
}));

describe("initDB", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should call createRxDatabase and add collections", async () => {
        const mockAddCollections = jest.fn();
        (createRxDatabase as jest.Mock).mockResolvedValue({
            addCollections: mockAddCollections,
        });

        const db = await initDB();

        expect(createRxDatabase).toHaveBeenCalled();
        expect(mockAddCollections).toHaveBeenCalledWith({
            users: expect.any(Object),
            plans: expect.any(Object),
            tasks: expect.any(Object),
        });
        expect(db).toHaveProperty("addCollections");
    });

    it("should throw and reset dbPromise if creation fails", async () => {
        (createRxDatabase as jest.Mock).mockRejectedValueOnce(
            new Error("fail")
        );

        await expect(initDB()).rejects.toThrow("fail");

        (createRxDatabase as jest.Mock).mockResolvedValue({
            addCollections: jest.fn(),
        });
        const db = await initDB();
        expect(db).toHaveProperty("addCollections");
    });
});
