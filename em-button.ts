import type { HandcraftElement } from "@handcraft/lib";
import { define, effect, observe } from "@handcraft/lib";

export default define("em-button").setup((host: HandcraftElement) => {
  const observed = observe(host);
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

  effect(() => {
    for (const button of observed("> button")) {
      button.on("click touchend", leftclick)
        .on("mousedown touchstart", longclick)
        .on("contextmenu", rightclick);
    }
  });
});
