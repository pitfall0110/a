// src/pages/LoginPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { initDB } from "../db";
import { useUser } from "../state/currentUser";

import {
    Box,
    Container,
    Paper,
    Stack,
    TextField,
    Typography,
    Button,
    CircularProgress,
    Alert,
} from "@mui/material";

export default function LoginPage() {
    const navigate = useNavigate();
    const setUserId = useUser((s) => s.setUserId);

    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleSubmit = async () => {
        setErr(null);
        if (!name.trim()) {
            setErr("Please enter your name.");
            return;
        }
        setBusy(true);
        try {
            const db = await initDB();

            const found = await db.users.findOne({ selector: { name } }).exec();
            let user: any = found?.toJSON();

            if (!user) {
                user = await db.users.insert({
                    id: uuid(),
                    name: name.trim(),
                    createdAt: new Date().toISOString(),
                });
                if (typeof user.toJSON === "function") user = user.toJSON();
            }

            setUserId(user.id);
            navigate("/plan");
        } catch (e: any) {
            console.error(e);
            setErr(
                "Could not initialize local database. Please reload and try again."
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <Container
            maxWidth="sm"
            sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
        >
            <Paper elevation={3} sx={{ p: 4, width: "100%" }}>
                <Stack spacing={2}>
                    <Typography variant="h5" fontWeight={600}>
                        Login
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Enter a name to continue. If the user doesn’t exist,
                        we’ll create it locally.
                    </Typography>

                    {err && <Alert severity="error">{err}</Alert>}

                    <TextField
                        label="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSubmit();
                        }}
                        autoFocus
                        fullWidth
                    />

                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            mt: 1,
                        }}
                    >
                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={busy}
                            endIcon={
                                busy ? <CircularProgress size={18} /> : null
                            }
                        >
                            {busy ? "Signing in…" : "Continue"}
                        </Button>
                    </Box>

                    <Typography variant="caption" color="text.secondary">
                        Data is stored locally (offline-first). Your documents
                        are separated by user.
                    </Typography>
                </Stack>
            </Paper>
        </Container>
    );
}
