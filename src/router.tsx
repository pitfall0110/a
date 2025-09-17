import { createBrowserRouter } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import PlanPage from "./pages/PlanPage";

export const router = createBrowserRouter([
    { path: "/", element: <LoginPage /> },
    { path: "/plan", element: <PlanPage /> },
]);
