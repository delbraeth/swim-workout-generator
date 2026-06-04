// src/main.jsx — SPA entry. Mounts <App/>. The app lives in src/App.jsx, shared
// helpers in src/lib/, components in src/components/. React/ReactDOM are CDN globals
// (public/index.html). esbuild bundles this entry → public/assets/app.js.
import { App } from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
