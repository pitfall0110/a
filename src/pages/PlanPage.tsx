import TopNav from "../components/TopNav";
import PlanCanvas from "../components/PlanCanvas";
import TaskDrawer from "../components/TaskDrawer";
import TaskModal from "../components/TaskModal";

export default function PlanPage() {
    return (
        <>
            <TopNav />
            <PlanCanvas />
            <TaskDrawer />
            <TaskModal />
        </>
    );
}
