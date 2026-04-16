import { h } from "@handcraft/lib/templating";
import mineSweeperCSS from "./mine-sweeper.css" with { type: "text" };

const {
  html,
  head,
  meta,
  title,
  link,
  script,
  style,
  template,
  body,
  "mine-sweeper": mineSweeper,
} = h.html;

export default function () {
  return html.lang("en-US")(
    head(
      meta.charset("utf-8"),
      meta.name("viewport").content("width=device-width, initial-scale=1"),
      title("Mine-Sweeper"),
      link.rel("stylesheet").href("/index.css"),
      script.type("module").src("/mine-sweeper.js"),
    ),
    body.class("page")(
      mineSweeper.count(10).height(8).width(8)(
        template.shadowrootmode("open")(
          style(mineSweeperCSS),
        ),
      ),
    ),
  );
}
