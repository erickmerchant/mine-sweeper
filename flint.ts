import css from "@flint/framework/plugins/css";
import js from "@flint/framework/plugins/js";
import flint from "@flint/framework";
import index from "./index.js";

const app = flint("public", "dist")
	.cache("/")
	.route("/", index)
	.use("/*.css", css)
	.use("/mine-sweeper.js", js);

export default app;

if (import.meta.main) {
	app.run();
}
