import { html } from "@handcraft/lib/h";
import attr from "@handcraft/lib/attr";
import text from "@handcraft/lib/text";
import mineSweeper from "../elements/mine-sweeper.ts";

export default function () {
  return html.html(
    attr.lang("en-US"),
    html.head(
      html.meta(attr.charset("utf-8")),
      html.meta(attr.name("viewport"), attr.content("width=device-width")),
      html.title(text("Mine-Sweeper")),
      html.link(attr.rel("stylesheet"), attr.href("/styles/index.css")),
      html.script(attr.type("module"), attr.src("/elements/mine-sweeper.js")),
    ),
    html.body(
      attr.class("page"),
      mineSweeper(attr.height(8), attr.width(8), attr.count(10)),
    ),
  );
}
