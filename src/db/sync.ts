import { initDB } from ".";

type Checkpoints = { tasks?: string };

export class SyncEngine {
    private pulling = false;
    private pushing = false;
    private stopped = false;
    private intervalId: any = null;
    private readonly baseUrl: string;
    private readonly clientId: string;
    constructor(baseUrl: string, clientId: string) {
        this.baseUrl = baseUrl;
        this.clientId = clientId;
    }

    start(ms = 8000) {
        if (this.intervalId) return;
        const tick = async () => {
            if (this.stopped || !navigator.onLine) return;
            await this.pullTasks();
            await this.pushTasks();
        };

        tick().catch(() => {});
        this.intervalId = setInterval(() => tick().catch(() => {}), ms);
        window.addEventListener("online", () => tick().catch(() => {}));
    }

    stop() {
        this.stopped = true;
        if (this.intervalId) clearInterval(this.intervalId);
    }

    private get cps(): Checkpoints {
        try {
            return JSON.parse(localStorage.getItem("sync-cp") || "{}");
        } catch {
            return {};
        }
    }
    private set cps(v: Checkpoints) {
        localStorage.setItem("sync-cp", JSON.stringify(v));
    }

    private async pullTasks() {
        if (this.pulling) return;
        this.pulling = true;
        try {
            const db = await initDB();
            const userId = sessionStorage.getItem("currentUserId");
            if (!userId) return;

            const since = this.cps.tasks || "1970-01-01T00:00:00.000Z";
            const res = await fetch(`${this.baseUrl}/sync/pull`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, since, limit: 500 }),
            });
            if (!res.ok) return;
            const { docs, checkpoint } = await res.json();
            // Upsert all docs (including _deleted)
            for (const d of docs) {
                const existing = await db.tasks.findOne(d.id).exec();
                if (!existing) {
                    await db.tasks.insert(d);
                } else {
                    const local = existing.toJSON();
                    // LWW by updatedAt; break ties by clientId
                    if (
                        new Date(d.updatedAt) > new Date(local.updatedAt) ||
                        (d.updatedAt === local.updatedAt &&
                            d.clientId !== this.clientId)
                    ) {
                        await existing.update({ $set: d });
                    }
                }
            }
            // advance checkpoint
            this.cps = { ...this.cps, tasks: checkpoint || since };
        } finally {
            this.pulling = false;
        }
    }

    private async pushTasks() {
        if (this.pushing) return;
        this.pushing = true;
        try {
            const db = await initDB();
            const userId = sessionStorage.getItem("currentUserId");
            if (!userId) return;

            // Send only our local changes since last push checkpoint.
            const since = this.cps.tasks || "1970-01-01T00:00:00.000Z";
            const changed = await db.tasks
                .find({
                    selector: { userId, updatedAt: { $gt: since } },
                    sort: [{ updatedAt: "asc" }],
                })
                .exec();

            if (!changed.length) return;

            const docs = changed.map((d) => d.toJSON());
            const res = await fetch(`${this.baseUrl}/sync/push`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, docs }),
            });
            if (!res.ok) return;
            const { conflicts } = await res.json();

            // conflict handling: prefer server, but try field-wise merge for checklist
            for (const c of conflicts || []) {
                const doc = await db.tasks.findOne(c.id).exec();
                if (!doc) continue;
                const merged = mergeTask(c.server, c.client);
                await doc.update({ $set: merged });
            }

            // bump checkpoint to newest updatedAt we just pushed
            const newest = docs[docs.length - 1]?.updatedAt || since;
            this.cps = { ...this.cps, tasks: newest };
        } finally {
            this.pushing = false;
        }
    }
}

// checklist merge: keep server, overlay client items by id
function mergeTask(server: any, client: any) {
    const byId = new Map<string, any>();
    (server.checklist || []).forEach((i: any) => byId.set(i.id, i));
    (client.checklist || []).forEach((i: any) =>
        byId.set(i.id, { ...(byId.get(i.id) || {}), ...i })
    );
    return { ...server, checklist: Array.from(byId.values()) };
}
