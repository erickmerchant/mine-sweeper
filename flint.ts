import css from "@flint/framework/plugins/css";
import js from "@flint/framework/plugins/js";
import flint from "@flint/framework";
import index from "./index.js";

const app = flint("public")
	.cache("/")
	.route("/", index)
	.route("/*.css", css)
	.route("/mine-sweeper.js", js)
	.output("dist");

export default app;

if (import.meta.main) {
	app.run();
}
