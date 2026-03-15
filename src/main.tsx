import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { initializeRuntimeData } from "./app/data/runtimeStore";
import "./styles/index.css";

initializeRuntimeData()
  .catch(() => undefined)
  .finally(() => {
    createRoot(document.getElementById("root")!).render(<App />);
  });
