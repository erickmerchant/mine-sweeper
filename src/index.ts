import type { FlintRouteContext } from "@flint/framework";
import { h, render, shadow } from "@handcraft/lib";

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

export default function ({ resolve }: FlintRouteContext) {
  return render(
    html.lang("en-US")(
      head(
        meta.charset("utf-8"),
        meta.name("viewport").content("width=device-width, initial-scale=1"),
        title("Mine-Sweeper"),
        link.rel("stylesheet").href(resolve("/index.css")),
        script.type("module").src(resolve("/mine-sweeper.js")),
      ),
      body.class("page")(
        mineSweeper.count(10).height(8).width(8)(
          shadow()(
            link.rel("stylesheet").href(resolve("/mine-sweeper.css")),
          ),
        ),
      ),
    ),
  );
}
