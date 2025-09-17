import { useEffect, useRef, useState } from "react";
import { useUI } from "../state/ui";
import { useUser } from "../state/currentUser";
import { initDB } from "../db";

type TaskDoc = {
    id: string;
    title?: string;
    position: { x: number; y: number };
};

/** Basic runtime validator*/
const isValidTask = (t: any): t is TaskDoc =>
    !!t &&
    typeof t.id === "string" &&
    t.position &&
    typeof t.position.x === "number" &&
    typeof t.position.y === "number" &&
    Number.isFinite(t.position.x) &&
    Number.isFinite(t.position.y);

async function initDBWithRetry(maxRetries = 3, baseDelayMs = 300) {
    let lastErr: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await initDB();
        } catch (err) {
            lastErr = err;
            if (attempt === maxRetries) break;
            const delay = baseDelayMs * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw lastErr;
}

export default function PlanCanvas() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const subRef = useRef<{ unsubscribe?: () => void } | null>(null);
    const mountedRef = useRef(true);
    const { pan, zoom, setPan, setZoom, openList, mode, setMode } = useUI();
    const { userId } = useUser();

    const [tasks, setTasks] = useState<TaskDoc[]>([]);
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const [error, setError] = useState<string | null>(null);

    // mountedRef tracking:
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Image loading
    useEffect(() => {
        const image = new Image();
        let loaded = false;
        image.onload = () => {
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                loaded = true;
                if (mountedRef.current) setImg(image);
            } else {
                console.error("plan image loaded but has invalid dimensions");
                setError("Plan image is invalid");
            }
        };
        image.onerror = (ev) => {
            console.error("plan image failed to load", ev);
            setError("Failed to load plan image");
        };
        image.src = "/plan.png";
        return () => {
            image.onload = null;
            image.onerror = null;
        };
    }, []);

    useEffect(() => {
        // clear old subscription
        if (!userId) {
            setTasks([]);
            subRef.current?.unsubscribe?.();
            subRef.current = null;
            return;
        }

        let unsubbed = false;
        subRef.current?.unsubscribe?.();
        subRef.current = null;
        setError(null);

        (async () => {
            try {
                const db = await initDBWithRetry(3, 300);
                if (!mountedRef.current || unsubbed) return;

                const obs = db.tasks.find({
                    selector: { userId, _deleted: { $eq: false } },
                }).$;

                const subscription = obs.subscribe({
                    next: (docs: any[]) => {
                        if (!mountedRef.current || unsubbed) return;
                        try {
                            const parsed: TaskDoc[] = [];
                            for (const d of docs) {
                                const raw =
                                    typeof d?.toJSON === "function"
                                        ? d.toJSON()
                                        : d;
                                if (!isValidTask(raw)) continue;
                                const x = Math.max(
                                    0,
                                    Math.min(1, raw.position.x)
                                );
                                const y = Math.max(
                                    0,
                                    Math.min(1, raw.position.y)
                                );
                                parsed.push({ ...raw, position: { x, y } });
                            }
                            setTasks(parsed);
                        } catch (processingErr) {
                            console.error(
                                "Error processing task docs",
                                processingErr
                            );
                        }
                    },
                    error: (subErr) => {
                        console.error("tasks subscription errored:", subErr);
                        if (mountedRef.current)
                            setError("Failed to subscribe to tasks");
                    },
                });

                subRef.current = {
                    unsubscribe: () => subscription.unsubscribe(),
                };
            } catch (err) {
                console.error("Failed to initDB or subscribe to tasks", err);
                if (mountedRef.current)
                    setError("Database initialization failed");
            }
        })();

        return () => {
            unsubbed = true;
            subRef.current?.unsubscribe?.();
            subRef.current = null;
        };
    }, [userId]);

    // Pan/zoom and placement handlers
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY))
                return;
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            const newZoom = Math.max(0.2, Math.min(8, zoom * factor));
            const wx = (cx - pan.x) / zoom;
            const wy = (cy - pan.y) / zoom;
            setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
            setZoom(newZoom);
        };

        const placeAt = (e: MouseEvent) => {
            if (!img || !userId) return;
            if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY))
                return;
            const rect = el.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const wx = (sx - pan.x) / zoom;
            const wy = (sy - pan.y) / zoom;
            if (!Number.isFinite(wx) || !Number.isFinite(wy)) return;
            const nx = Math.max(0, Math.min(1, wx / img.width));
            const ny = Math.max(0, Math.min(1, wy / img.height));
            try {
                window.dispatchEvent(
                    new CustomEvent("request-new-task", { detail: { nx, ny } })
                );
            } catch (err) {
                console.error("Failed to dispatch new task event", err);
            }
            setMode("select");
            openList();
        };

        const onMouseDown = (e: MouseEvent) => {
            const isPan = e.button === 1 || mode === "pan";
            if (!isPan && mode === "place" && e.button === 0) {
                placeAt(e);
                return;
            }
            if (isPan) {
                const start = { x: e.clientX, y: e.clientY };
                const startPan = { ...pan };
                const move = (ev: MouseEvent) =>
                    setPan({
                        x: startPan.x + (ev.clientX - start.x),
                        y: startPan.y + (ev.clientY - start.y),
                    });
                const up = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
            }
        };

        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("mousedown", onMouseDown);
        return () => {
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("mousedown", onMouseDown);
        };
    }, [
        canvasRef,
        pan,
        zoom,
        img,
        mode,
        userId,
        setPan,
        setZoom,
        setMode,
        openList,
    ]);

    // Canvas sizing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const setSize = () => {
            const ratio = window.devicePixelRatio || 1;
            const w = Math.max(0, window.innerWidth - 360);
            const h = window.innerHeight;
            canvas.width = Math.floor(w * ratio);
            canvas.height = Math.floor(h * ratio);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        };
        setSize();
        window.addEventListener("resize", setSize);
        return () => window.removeEventListener("resize", setSize);
    }, []);

    // Render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let raf = 0;
        let errorCount = 0;
        const draw = () => {
            try {
                const { width, height } = canvas;
                ctx.save();
                ctx.clearRect(0, 0, width, height);
                ctx.fillStyle = "#e5e7eb";
                ctx.fillRect(0, 0, width, height);

                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(
                    img,
                    pan.x,
                    pan.y,
                    img.width * zoom,
                    img.height * zoom
                );

                const wx0 = -pan.x / zoom;
                const wy0 = -pan.y / zoom;
                const wx1 = wx0 + width / zoom;
                const wy1 = wy0 + height / zoom;

                for (const t of tasks) {
                    if (!t?.position) continue;
                    const wx = t.position.x * img.width;
                    const wy = t.position.y * img.height;
                    if (!Number.isFinite(wx) || !Number.isFinite(wy)) continue;
                    if (wx < wx0 || wx > wx1 || wy < wy0 || wy > wy1) continue;
                    const sx = pan.x + wx * zoom;
                    const sy = pan.y + wy * zoom;
                    ctx.beginPath();
                    ctx.arc(
                        sx,
                        sy,
                        Math.max(10, 6 * Math.sqrt(zoom)),
                        0,
                        Math.PI * 2
                    );
                    ctx.fillStyle = "#15b90fff";
                    ctx.fill();
                }

                ctx.restore();
                errorCount = 0;
            } catch (err) {
                console.error("Canvas draw error:", err);
                errorCount++;
                if (errorCount > 5) {
                    cancelAnimationFrame(raf);
                    if (mountedRef.current) setError("Canvas rendering failed");
                    return;
                }
            }
            raf = requestAnimationFrame(draw);
        };

        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [img, tasks, pan, zoom]);

    return (
        <div className="h-full w-full relative flex justify-center items-center bg-gray-200">
            {error ? (
                <div className="absolute z-10 p-2 text-sm text-red-700 bg-white/90 rounded">
                    {error}
                </div>
            ) : null}
            <canvas
                ref={canvasRef}
                className={
                    mode === "place" ? "cursor-crosshair" : "cursor-default"
                }
            />
        </div>
    );
}
