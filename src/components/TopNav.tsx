import { useNavigate } from "react-router-dom";
import { useUI } from "../state/ui";
import { Button } from "@mui/material";

export default function TopNav() {
    const { setMode, openList } = useUI();
    const navigate = useNavigate();
    return (
        <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
                <Button
                    className="px-3 py-1 border rounded"
                    onClick={() => setMode("place")}
                >
                    + Add Task
                </Button>
                <Button onClick={openList}>TaskList</Button>
            </div>
            <div className="flex items-center gap-4">
                <Button
                    onClick={() => {
                        navigate("/");
                    }}
                >
                    Logout
                </Button>
            </div>
        </div>
    );
}
