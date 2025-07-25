import { h, render } from "handcraft/env/server.js";

const {
	html,
	head,
	meta,
	title,
	link,
	script,
	body,
	"mine-sweeper": mineSweeper,
} = h.html;

export default function (_, resolve) {
	const main = mineSweeper.count(10).height(8).width(8);

	main.shadow()(
		link.rel("stylesheet").href(resolve("/mine-sweeper.css")),
	);

	return render(
		html.lang("en-US")(
			head(
				meta.charset("utf-8"),
				meta.name("viewport").content("width=device-width, initial-scale=1"),
				title("Mine-Sweeper"),
				link.rel("stylesheet").href(resolve("/page.css")),
				script.type("module").src(resolve("/mine-sweeper.js")),
			),
			body.class("page")(main),
		),
	);
}
