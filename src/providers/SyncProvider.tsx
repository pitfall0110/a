// src/providers/SyncProvider.tsx
import { useEffect, useRef } from "react";
import { getOrCreateClientId } from "../lib/id";
import { useUser } from "../state/currentUser";
import { SyncEngine } from "../db/sync";

type Props = {
    apiBase?: string;
    intervalMs?: number;
    children: React.ReactNode;
};

export default function SyncProvider({
    apiBase = import.meta.env.VITE_API ?? "",
    intervalMs = 8000,
    children,
}: Props) {
    const { userId } = useUser();
    const engineRef = useRef<SyncEngine | null>(null);
    const clientId = getOrCreateClientId();

    useEffect(() => {
        if (!userId || !apiBase) {
            // stop any running engine
            engineRef.current?.stop();
            engineRef.current = null;
            return;
        }

        // Start a fresh engine for this userId
        const engine = new SyncEngine(apiBase, clientId);
        engine.start(intervalMs);
        engineRef.current = engine;

        return () => {
            engine.stop();
            engineRef.current = null;
        };
    }, [userId, apiBase, clientId, intervalMs]);

    return <>{children}</>;
}
