import { $, define } from "@handcraft/lib";

export default define("em-button", {
  connected(host: Element) {
    const state: {
      start: number;
      timeout?: number | null;
    } = {
      start: Infinity,
      timeout: null,
    };

    const button = host.querySelector(":scope > button");

    if (button) {
      $(button).on("click touchend", leftclick)
        .on("mousedown touchstart", longclick)
        .on("contextmenu", rightclick);
    }

    function reset() {
      if (state.timeout) {
        clearTimeout(state.timeout);
      }

      state.start = Infinity;
    }

    function leftclick(e: Event) {
      if (Date.now() - state.start < 1_000) {
        reset();

        e.currentTarget?.dispatchEvent(
          new Event("leftclick", { bubbles: true, composed: true }),
        );
      }
    }

    function longclick(e: Event) {
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
    }

    function rightclick(e: Event) {
      e.preventDefault();

      reset();

      e.currentTarget?.dispatchEvent(
        new Event("rightclick", { bubbles: true, composed: true }),
      );
    }
  },
});
