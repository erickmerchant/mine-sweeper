import css from "@flint/framework/plugins/css";
import js from "@flint/framework/plugins/js";
import flint from "@flint/framework";
import index from "./index.js";
import { render } from "@handcraft/lib";

const app = flint("public", "dist")
  .cache("/")
  .route(
    "/",
    async (c: { resolve: (url: string) => string }) => render(await index(c)),
  )
  .use("/*.css", css)
  .use("/mine-sweeper.js", js);

export default app;

if (import.meta.main) {
  app.run();
}
