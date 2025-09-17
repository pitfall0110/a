import { useEffect, useMemo, useState } from "react";
import { v4 as uuid } from "uuid";
import { initDB } from "../db";
import { useUI } from "../state/ui";
import { useUser } from "../state/currentUser";
import {
    Box,
    Drawer,
    Toolbar,
    Typography,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Divider,
    Stack,
    Select,
    MenuItem,
    Chip,
    Button,
    useMediaQuery,
    TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { useTheme } from "@mui/material/styles";

type ChecklistStatus =
    | "not_started"
    | "in_progress"
    | "blocked"
    | "final_check"
    | "done";

const STATUS_LABEL: Record<ChecklistStatus, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    blocked: "Blocked",
    final_check: "Final Check awaiting",
    done: "Done",
};

const STATUS_COLOR: Record<
    ChecklistStatus,
    "default" | "primary" | "warning" | "error" | "success"
> = {
    not_started: "default",
    in_progress: "primary",
    blocked: "error",
    final_check: "warning",
    done: "success",
};

export default function TaskDrawer() {
    const { drawer, selectedTaskId, openDetails, openList, closeDrawer } =
        useUI();
    const { userId } = useUser();
    const [tasks, setTasks] = useState<any[]>([]);
    const [selected, setSelected] = useState<any | null>(null);
    const [newItemText, setNewItemText] = useState("");

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const anchor: "right" | "bottom" = isMobile ? "bottom" : "right";
    const open = drawer !== "closed";

    // Live subscription to tasks
    useEffect(() => {
        let unsub = () => {};
        (async () => {
            if (!userId) return;
            const db = await initDB();
            const sub = db.tasks
                .find({ selector: { userId, _deleted: { $eq: false } } })
                .$.subscribe((docs: any[]) =>
                    setTasks(docs.map((d) => d.toJSON()))
                );
            unsub = () => sub.unsubscribe();
        })();
        return () => unsub();
    }, [userId]);

    useEffect(() => {
        setSelected(tasks.find((t) => t.id === selectedTaskId) ?? null);
    }, [tasks, selectedTaskId]);

    // helpers to modify checklist
    const addChecklistItem = async (taskId: string, text: string) => {
        if (!text.trim()) return;
        const db = await initDB();
        const doc = await db.tasks.findOne(taskId).exec();
        if (!doc) return;
        const t = doc.toJSON();
        const next = [
            ...t.checklist,
            { id: uuid(), text: text.trim(), status: "not_started" },
        ];
        await doc.update({
            $set: { checklist: next, updatedAt: new Date().toISOString() },
        });
        setNewItemText("");
    };

    const deleteChecklistItem = async (taskId: string, itemId: string) => {
        const db = await initDB();
        const doc = await db.tasks.findOne(taskId).exec();
        if (!doc) return;
        const t = doc.toJSON();
        const next = t.checklist.filter((c: any) => c.id !== itemId);
        await doc.update({
            $set: { checklist: next, updatedAt: new Date().toISOString() },
        });
    };

    // delete logic (soft-delete - offline safe)
    const handleDelete = async (id: string) => {
        const db = await initDB();
        await db.tasks.findOne(id).update({
            $set: { _deleted: true, updatedAt: new Date().toISOString() },
        });
        openList();
    };

    // update status for checklist item
    const updateChecklistStatus = async (
        taskId: string,
        itemId: string,
        status: ChecklistStatus
    ) => {
        const db = await initDB();
        const doc = await db.tasks.findOne(taskId).exec();
        if (!doc) return;
        const t = doc.toJSON();
        const checklist = t.checklist.map((it: any) =>
            it.id === itemId ? { ...it, status } : it
        );
        await doc.update({
            $set: { checklist, updatedAt: new Date().toISOString() },
        });
    };

    // Drawer Body: List
    const ListBody = (
        <Box sx={{ p: 2 }}>
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
            >
                <Typography variant="h6">Tasks</Typography>
                <IconButton
                    size="small"
                    onClick={closeDrawer}
                    aria-label="Close drawer"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            <List dense disablePadding>
                {tasks.length === 0 && (
                    <ListItem>
                        <ListItemText
                            primary="No tasks yet"
                            primaryTypographyProps={{ color: "text.secondary" }}
                        />
                    </ListItem>
                )}
                {tasks.map((t) => {
                    const doneCount = t.checklist.filter(
                        (c: any) => c.status === "done"
                    ).length;
                    const total = t.checklist.length || 0;
                    return (
                        <ListItem
                            key={t.id}
                            secondaryAction={
                                <Stack direction="row" spacing={1}>
                                    <IconButton
                                        aria-label="Open details"
                                        size="small"
                                        onClick={() => openDetails(t.id)}
                                    >
                                        <OpenInNewIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                        aria-label="Delete task"
                                        size="small"
                                        onClick={() => handleDelete(t.id)}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            }
                            sx={{
                                borderRadius: 1,
                                "&:hover": { background: "action.hover" },
                            }}
                        >
                            <ListItemText
                                primary={
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        spacing={1}
                                    >
                                        <Typography variant="body1" noWrap>
                                            {t.title}
                                        </Typography>
                                        {total > 0 && (
                                            <Chip
                                                size="small"
                                                label={`${doneCount}/${total}`}
                                                color={
                                                    doneCount === total &&
                                                    total > 0
                                                        ? "success"
                                                        : "default"
                                                }
                                            />
                                        )}
                                    </Stack>
                                }
                                secondary={new Date(
                                    t.updatedAt
                                ).toLocaleString()}
                                primaryTypographyProps={{ fontWeight: 500 }}
                            />
                        </ListItem>
                    );
                })}
            </List>
        </Box>
    );

    // Drawer Body: Details
    const DetailsBody = selected && (
        <Box sx={{ p: 2 }}>
            <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mb: 1 }}
            >
                <IconButton
                    size="small"
                    onClick={openList}
                    aria-label="Back to list"
                >
                    <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography variant="h6" sx={{ flex: 1 }} noWrap>
                    {selected.title}
                </Typography>
                <IconButton
                    size="small"
                    onClick={() => handleDelete(selected.id)}
                    aria-label="Delete"
                >
                    <DeleteOutlineIcon fontSize="small" />
                </IconButton>
                <IconButton
                    size="small"
                    onClick={closeDrawer}
                    aria-label="Close"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Checklist
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Add new checklist item…"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter")
                            addChecklistItem(selected.id, newItemText);
                    }}
                />
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => addChecklistItem(selected.id, newItemText)}
                    disabled={!newItemText.trim()}
                >
                    Add
                </Button>
            </Stack>

            <Stack spacing={1.25}>
                {selected.checklist?.map((c: any) => (
                    <Stack
                        key={c.id}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            p: 1,
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{ flex: 1 }}
                            noWrap
                            title={c.text}
                        >
                            {c.text || "(untitled)"}
                        </Typography>

                        <Chip
                            size="small"
                            label={STATUS_LABEL[c.status as ChecklistStatus]}
                            color={STATUS_COLOR[c.status as ChecklistStatus]}
                            sx={{ mr: 0.5 }}
                        />

                        <Select
                            size="small"
                            value={
                                (c.status as ChecklistStatus) ?? "not_started"
                            }
                            onChange={(e) =>
                                updateChecklistStatus(
                                    selected.id,
                                    c.id,
                                    e.target.value as ChecklistStatus
                                )
                            }
                            sx={{ minWidth: 160 }}
                        >
                            <MenuItem value="not_started">Not started</MenuItem>
                            <MenuItem value="in_progress">In progress</MenuItem>
                            <MenuItem value="blocked">Blocked</MenuItem>
                            <MenuItem value="final_check">
                                Final Check awaiting
                            </MenuItem>
                            <MenuItem value="done">Done</MenuItem>
                        </Select>

                        <IconButton
                            aria-label="Remove item"
                            size="small"
                            onClick={() =>
                                deleteChecklistItem(selected.id, c.id)
                            }
                        >
                            <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                ))}
                {(!selected.checklist || selected.checklist.length === 0) && (
                    <Typography variant="body2" color="text.secondary">
                        No checklist items
                    </Typography>
                )}
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button variant="outlined" onClick={openList}>
                    Back
                </Button>
                <Button variant="contained" onClick={closeDrawer}>
                    Close
                </Button>
            </Stack>
        </Box>
    );

    return (
        <Drawer
            anchor={anchor}
            open={open}
            onClose={closeDrawer}
            PaperProps={{
                sx: {
                    width: isMobile ? "100%" : 380,
                    height: isMobile ? "60%" : "100%",
                },
            }}
            ModalProps={{ keepMounted: true }}
        >
            <Toolbar sx={{ display: { xs: "none", md: "block" } }} />
            {drawer === "details" ? DetailsBody : ListBody}
        </Drawer>
    );
}
