import { h } from "@handcraft/lib";
import mineSweeper from "../elements/mine-sweeper.ts";

const {
  html,
  head,
  meta,
  title,
  link,
  script,
  body,
} = h.html;

export default function () {
  return html.lang("en-US")(
    head(
      meta.charset("utf-8"),
      meta.name("viewport").content("width=device-width, initial-scale=1"),
      title("Mine-Sweeper"),
      link.rel("stylesheet").href("/styles/index.css"),
      script.type("module").src("/elements/mine-sweeper.js"),
    ),
    body.class("page")(
      mineSweeper.height(8).width(8).count(10),
    ),
  );
}
