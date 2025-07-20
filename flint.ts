import css from "@flint/framework/plugins/css";
import js from "@flint/framework/plugins/js";
import create from "@flint/framework/create";
import index from "./index.js";

const app = create("public")
	.cache(["/"])
	.route("/", index)
	.route("/*.css", css)
	.route("/mine-sweeper.js", js)
	.output("dist");

export default app;

if (import.meta.main) {
	app.run();
}
