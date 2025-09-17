import { SyncEngine } from "./sync";
import * as dbModule from "../db";

jest.useFakeTimers();

// Mock initDB
const mockTasksCollection = {
    findOne: jest.fn(),
    find: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    exec: jest.fn(),
};

const mockDB = {
    tasks: mockTasksCollection,
};

jest.spyOn(dbModule, "initDB").mockResolvedValue(mockDB as any);

// Mock fetch
(globalThis as any).fetch = jest.fn();

// Mock localStorage & sessionStorage
const storage: Record<string, string> = {};
(globalThis as any).localStorage = {
    getItem: jest.fn((key) => storage[key] || null),
    setItem: jest.fn((key, value) => (storage[key] = value)),
    removeItem: jest.fn((key) => delete storage[key]),
    clear: jest.fn(() =>
        Object.keys(storage).forEach((k) => delete storage[k])
    ),
} as any;

(globalThis as any).sessionStorage = {
    getItem: jest.fn(() => "testUser"),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
} as any;

describe("SyncEngine", () => {
    let engine: SyncEngine;

    beforeEach(() => {
        jest.clearAllMocks();
        storage["sync-cp"] = "";
        engine = new SyncEngine("http://fake-api.com", "client1");
    });

    it("should start and schedule pull/push", async () => {
        ((globalThis as any).fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                docs: [],
                checkpoint: "2025-01-01T00:00:00.000Z",
            }),
        });

        engine.start(1000);

        // tick immediately
        await Promise.resolve();

        expect(dbModule.initDB).toHaveBeenCalled();
        expect(engine["pulling"]).toBe(false);
        expect(engine["pushing"]).toBe(false);

        // advance interval
        jest.advanceTimersByTime(1000);
        await Promise.resolve();

        expect(dbModule.initDB).toHaveBeenCalledTimes(2);
    });

    it("should stop clearing interval", () => {
        engine["intervalId"] = 123 as any;
        const clearSpy = jest.spyOn(globalThis as any, "clearInterval");
        engine.stop();
        expect(engine["stopped"]).toBe(true);
        expect(clearSpy).toHaveBeenCalledWith(123);
    });

    it("should pull tasks and upsert", async () => {
        const task = {
            id: "t1",
            updatedAt: "2025-01-01T00:00:00.000Z",
            clientId: "other",
        };
        ((globalThis as any).fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ docs: [task], checkpoint: task.updatedAt }),
        });
        mockTasksCollection.findOne.mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
        });
        mockTasksCollection.insert.mockResolvedValue(null);

        await engine["pullTasks"]();

        expect(mockTasksCollection.insert).toHaveBeenCalledWith(task);
        expect(storage["sync-cp"]).toContain(task.updatedAt);
    });

    it("should push tasks", async () => {
        const changedTask = { id: "t1", updatedAt: "2025-01-01T00:00:00.000Z" };
        mockTasksCollection.find.mockReturnValue({
            exec: jest.fn().mockResolvedValue([
                {
                    toJSON: () => changedTask,
                },
            ]),
        });

        ((globalThis as any).fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ conflicts: [] }),
        });

        await engine["pushTasks"]();

        expect((globalThis as any).fetch).toHaveBeenCalledWith(
            "http://fake-api.com/sync/push",
            expect.any(Object)
        );
        expect(storage["sync-cp"]).toContain(changedTask.updatedAt);
    });

    it("mergeTask merges server and client checklist correctly", () => {
        const server = { checklist: [{ id: "1", name: "A" }] };
        const client = {
            checklist: [
                { id: "1", done: true },
                { id: "2", done: false },
            ],
        };

        const merged = (engine as any).mergeTask(server, client);
        expect(merged.checklist).toEqual([
            { id: "1", name: "A", done: true },
            { id: "2", done: false },
        ]);
    });
});
