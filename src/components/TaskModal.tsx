import { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    IconButton,
    Stack,
    Select,
    MenuItem,
    Typography,
    Divider,
    Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import { v4 as uuid } from "uuid";
import { initDB } from "../db";
import { useUser } from "../state/currentUser";

type ChecklistStatus =
    | "not_started"
    | "in_progress"
    | "blocked"
    | "final_check"
    | "done";
type ChecklistItem = { id: string; text: string; status: ChecklistStatus };
type TaskInput = {
    id?: string;
    userId: string;
    planId: string;
    title: string;
    position: { x: number; y: number; anchor?: string };
    checklist: ChecklistItem[];
    createdAt?: string;
    updatedAt?: string;
    _deleted?: boolean;
};

const STATUS_LABEL: Record<ChecklistStatus, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    blocked: "Blocked",
    final_check: "Final Check awaiting",
    done: "Done",
};

const DEFAULT_CHECKLIST = (): ChecklistItem[] => [
    { id: uuid(), text: "Site prepared", status: "not_started" },
    { id: uuid(), text: "Materials ready", status: "in_progress" },
    { id: uuid(), text: "Work completed", status: "final_check" },
];

export default function TaskModal({
    taskToEdit,
    onClose: onCloseProp,
}: {
    taskToEdit?: any;
    onClose?: () => void;
}) {
    const { userId } = useUser();
    const [open, setOpen] = useState<boolean>(Boolean(taskToEdit));
    const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

    // local form state
    const [title, setTitle] = useState<string>(taskToEdit?.title ?? "");
    const [items, setItems] = useState<ChecklistItem[]>(
        (taskToEdit?.checklist as ChecklistItem[] | undefined)?.map((c) => ({
            ...c,
        })) ?? DEFAULT_CHECKLIST()
    );

    const planId = taskToEdit?.planId ?? "default";
    const isEdit = Boolean(taskToEdit?.id);

    useEffect(() => {
        const handler = (e: any) => {
            if (isEdit) return;
            const { nx, ny } = e.detail || {};
            setCoords({ x: nx, y: ny });
            setOpen(true);
        };
        window.addEventListener("request-new-task", handler as any);
        return () =>
            window.removeEventListener("request-new-task", handler as any);
    }, [isEdit]);

    useEffect(() => {
        if (taskToEdit) {
            setOpen(true);
            setTitle(taskToEdit.title ?? "");
            setItems((taskToEdit.checklist ?? []).map((c: any) => ({ ...c })));
            setCoords(
                taskToEdit.position
                    ? { x: taskToEdit.position.x, y: taskToEdit.position.y }
                    : null
            );
        }
    }, [taskToEdit]);

    const canSave = useMemo(() => {
        if (!userId) return false;
        if (!title.trim()) return false;
        if (!isEdit && !coords) return false; // need coords for new tasks
        return true;
    }, [userId, title, coords, isEdit]);

    const onClose = () => {
        setOpen(false);
        onCloseProp?.();
    };

    const onAddChecklistItem = () => {
        setItems((prev) => [
            ...prev,
            { id: uuid(), text: "", status: "not_started" },
        ]);
    };

    const onRemoveChecklistItem = (id: string) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
    };

    const onChangeChecklistItem = (
        id: string,
        patch: Partial<ChecklistItem>
    ) => {
        setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
        );
    };

    const handleSave = async () => {
        if (!userId) return;
        const db = await initDB();
        const now = new Date().toISOString();

        if (isEdit) {
            // update existing
            const doc = await db.tasks.findOne(taskToEdit.id).exec();
            if (!doc) return;
            await doc.update({
                $set: {
                    title: title.trim(),
                    checklist: items,
                    updatedAt: now,
                },
            });
            onClose();
            return;
        }
        // new task
        const newDoc: TaskInput = {
            id: uuid(),
            userId,
            planId,
            title: title.trim(),
            position: { x: coords!.x, y: coords!.y, anchor: "center" },
            checklist: items,
            createdAt: now,
            updatedAt: now,
            _deleted: false,
        };
        await db.tasks.insert(newDoc);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle
                sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1.5 }}
            >
                {isEdit ? "Edit Task" : "New Task"}
                <IconButton
                    onClick={onClose}
                    sx={{ ml: "auto" }}
                    aria-label="Close"
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                {!isEdit && coords && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mb: 1 }}
                    >
                        Position: ({coords.x.toFixed(3)}, {coords.y.toFixed(3)})
                        — normalized
                    </Typography>
                )}

                <TextField
                    label="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    fullWidth
                    autoFocus
                    required
                    margin="dense"
                />

                <Divider sx={{ my: 2 }} />

                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                >
                    <Typography variant="subtitle2">Checklist</Typography>
                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={onAddChecklistItem}
                    >
                        Add item
                    </Button>
                </Stack>

                <Stack spacing={1.25}>
                    {items.map((it) => (
                        <Stack
                            key={it.id}
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
                            <TextField
                                placeholder="Item description"
                                value={it.text}
                                onChange={(e) =>
                                    onChangeChecklistItem(it.id, {
                                        text: e.target.value,
                                    })
                                }
                                size="small"
                                fullWidth
                            />
                            <Select
                                size="small"
                                value={it.status}
                                onChange={(e) =>
                                    onChangeChecklistItem(it.id, {
                                        status: e.target
                                            .value as ChecklistStatus,
                                    })
                                }
                                sx={{ minWidth: 180 }}
                            >
                                <MenuItem value="not_started">
                                    {STATUS_LABEL.not_started}
                                </MenuItem>
                                <MenuItem value="in_progress">
                                    {STATUS_LABEL.in_progress}
                                </MenuItem>
                                <MenuItem value="blocked">
                                    {STATUS_LABEL.blocked}
                                </MenuItem>
                                <MenuItem value="final_check">
                                    {STATUS_LABEL.final_check}
                                </MenuItem>
                                <MenuItem value="done">
                                    {STATUS_LABEL.done}
                                </MenuItem>
                            </Select>
                            <Tooltip title="Remove item">
                                <IconButton
                                    onClick={() => onRemoveChecklistItem(it.id)}
                                    aria-label="Remove checklist item"
                                >
                                    <DeleteOutlineIcon />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    ))}
                    {items.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                            No checklist items — add one above.
                        </Typography>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} startIcon={<CloseIcon />}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={!canSave}
                    variant="contained"
                    startIcon={<SaveIcon />}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
