import type { HandcraftElement } from "@handcraft/lib";
import { define, h } from "@handcraft/lib";

const { button, slot, style } = h.html;

export default define("em-button").setup((host: HandcraftElement) => {
  const state: {
    start: number;
    timeout?: number | null;
  } = {
    start: Infinity,
    timeout: null,
  };

  const reset = () => {
    if (state.timeout) {
      clearTimeout(state.timeout);
    }

    state.start = Infinity;
  };
  const leftclick = (e: Event) => {
    if (Date.now() - state.start < 1_000) {
      reset();

      e.currentTarget?.dispatchEvent(
        new Event("leftclick", { bubbles: true, composed: true }),
      );
    }
  };
  const longclick = (e: Event) => {
    e.preventDefault();

    state.start = Date.now();

    state.timeout = setTimeout(
      (el?: Element) => {
        state.start = Infinity;

        el?.dispatchEvent(
          new Event("longclick", { bubbles: true, composed: true }),
        );
      },
      1_000,
      e.currentTarget,
    );
  };
  const rightclick = (e: Event) => {
    e.preventDefault();

    reset();

    e.currentTarget?.dispatchEvent(
      new Event("rightclick", { bubbles: true, composed: true }),
    );
  };

  return host.shadow(
    { mode: "open" },
    style(`* { box-sizing: border-box; margin: 0; padding: 0; font: inherit }`),
    button
      .part("button")
      .type("button")
      .on("click touchend", leftclick)
      .on("mousedown touchstart", longclick)
      .on("contextmenu", rightclick)(slot),
  );
});
