import css from "@flint/framework/handlers/css";
import js from "@flint/framework/handlers/js";
import flint from "@flint/framework";
import { view } from "@handcraft/lib/ssr";
import index from "./pages/index.ts";

const app = flint()
  .route("/", view(index))
  .route("/robots.txt")
  .file("/styles/index.css", css)
  .file("/elements/mine-sweeper.js", js)
  .file("/elements/mine-sweeper.css", css);

export default app;

if (import.meta.main) {
  app.run();
}
