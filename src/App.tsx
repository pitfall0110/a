import { RouterProvider } from "react-router-dom";
import SyncProvider from "./providers/SyncProvider";
import { router } from "./router";

function App() {
    return (
        <SyncProvider>
            <RouterProvider router={router} />
        </SyncProvider>
    );
}

export default App;
