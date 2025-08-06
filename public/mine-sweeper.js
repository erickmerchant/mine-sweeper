import "handcraft/dom/aria.js";
import "handcraft/dom/attr.js";
import "handcraft/dom/classes.js";
import "handcraft/dom/css.js";
import "handcraft/dom/effect.js";
import "handcraft/dom/nodes.js";
import "handcraft/dom/observer.js";
import "handcraft/dom/on.js";
import "handcraft/dom/shadow.js";
import { h } from "handcraft/dom.js";
import { effect, watch } from "handcraft/reactivity.js";
import { define } from "handcraft/define.js";

const { div, button, span } = h.html;

const PLAY_STATES = {
  PLAYING: 0,
  LOST: 1,
  WON: 2,
};

define("mine-sweeper").setup((host) => {
  const state = watch({
    playState: PLAY_STATES.PLAYING,
    time: 0,
    hasFocus: [],
    height: 0,
    width: 0,
  });

  let gameBoard, adjacentMap;

  effect(() => {
    gameBoard = new Map();
    adjacentMap = new Map();

    clearInterval(state.timeInterval);

    state.height = +(host.attr("height") ?? 8);
    state.width = +(host.attr("width") ?? 8);
    state.count = +(host.attr("count") ?? 10);
    state.mask = host.attr("mask")?.split?.(",") ??
      range(state.height).map(() => range(state.width).fill("1").join(""));
    state.flags = state.count;
    state.hidden = state.height * state.width;

    state.playState = PLAY_STATES.PLAYING;
    state.time = 0;
    state.hasFocus = [];
    state.startTime = null;
    state.timeInterval = null;
  });

  const infoPanel = div.classes("info-panel")(
    div(() => `🚩 ${state.flags}`),
    div.aria({ live: "polite" })(() => ["", "💀", "🎉"][state.playState]),
    div(() => `${state.time} ⏱️`),
  );
  const board = () =>
    div
      .aria({
        rowcount: state.height,
        colcount: state.width,
      })
      .role("grid")
      .classes("grid")(
        range(state.height).map((row) =>
          div
            .aria({
              rowindex: row + 1,
            })
            .role("row")
            .classes("row")(range(state.width).map((col) => cell(row, col)))
        ),
      );
  const shadow = host.shadow();

  shadow.css(
    () => `:host { --width: ${state.width}; --height: ${state.height};`,
  );

  shadow(infoPanel, board);

  function cell(row, col) {
    if (state.mask[row][col] !== "1") return span().classes("blank");

    const square = watch({
      x: col,
      y: row,
      isFlagged: false,
      isRevealed: false,
      isArmed: false,
      armedAdjacentCount: 0,
      mouseDownStartTime: Infinity,
      mouseDownTimeout: null,
    });
    const revealSquare = () => {
      if (Date.now() - square.mouseDownStartTime < 1_000) {
        if (state.playState !== PLAY_STATES.PLAYING) {
          return;
        }

        if (state.hidden === state.height * state.width) {
          let armed = [...gameBoard.values()].map((s) => ({
            square: s,
            order: s === square ? 2 : Math.random(),
          }));

          armed.sort((a, b) => a.order - b.order);

          armed = armed.splice(0, state.count);

          for (const { square } of armed) {
            square.isArmed = true;

            for (const adjacent of getAdjacent(square.x, square.y)) {
              adjacent.armedAdjacentCount += 1;
            }
          }

          state.playState = PLAY_STATES.PLAYING;

          state.startTime = Date.now();
          state.timeInterval = setInterval(updateTime, 250);
        }

        if (!square.isFlagged && !square.isRevealed) {
          square.isRevealed = true;

          state.hidden -= 1;

          if (square.isArmed) {
            state.playState = PLAY_STATES.LOST;

            clearInterval(state.timeInterval);

            for (const square of gameBoard.values()) {
              if (!square.isFlagged || !square.isArmed) {
                square.isRevealed = true;
              }
            }
          } else {
            if (!square.isFlagged && square.armedAdjacentCount === 0) {
              let current = getAdjacent(col, row);

              do {
                const next = [];

                for (const square of current) {
                  if (!square || square.isRevealed) {
                    continue;
                  }

                  if (
                    !square.isArmed &&
                    !square.isFlagged &&
                    !square.isRevealed
                  ) {
                    square.isRevealed = true;

                    state.hidden -= 1;

                    if (square.armedAdjacentCount === 0) {
                      next.push(...getAdjacent(square.x, square.y));
                    }
                  }
                }

                current = next;
              } while (current.length > 0);
            }

            if (state.hidden === state.count) {
              state.playState = PLAY_STATES.WON;

              for (const square of gameBoard.values()) {
                if (!square.isFlagged) {
                  if (square.isArmed) {
                    square.isFlagged = true;
                  } else {
                    square.isRevealed = true;
                  }
                }
              }

              state.flags = 0;

              clearInterval(state.timeInterval);
            }
          }
        }
      }

      square.mouseDownStartTime = Infinity;

      clearTimeout(square.mouseDownTimeout);
    };
    const toggleFlagDelayed = (e) => {
      if (state.playState !== PLAY_STATES.PLAYING) {
        return;
      }

      e.preventDefault();

      square.mouseDownStartTime = Date.now();

      square.mouseDownTimeout = setTimeout(() => {
        if (!square.isRevealed) {
          square.isFlagged = !square.isFlagged;

          state.flags += square.isFlagged ? -1 : 1;
        }
      }, 1_000);
    };
    const toggleFlagImmediately = (e) => {
      if (state.playState !== PLAY_STATES.PLAYING) {
        return;
      }

      e.preventDefault();

      if (!square.isRevealed) {
        square.isFlagged = !square.isFlagged;

        state.flags += square.isFlagged ? -1 : 1;
      }

      square.mouseDownStartTime = Infinity;

      clearTimeout(square.mouseDownTimeout);
    };
    const moveFocus = (e) => {
      const keys = {
        ArrowUp: row > 0 ? [col, row - 1] : [],
        ArrowDown: row < state.height - 1 ? [col, row + 1] : [],
        ArrowLeft: col > 0
          ? [col - 1, row]
          : row > 0
          ? [state.width - 1, row - 1]
          : [],
        ArrowRight: col < state.width - 1
          ? [col + 1, row]
          : row < state.height - 1
          ? [0, row + 1]
          : [],
      };

      state.hasFocus = keys?.[e.key] ?? [];
    };
    const focus = (el) => {
      if (state.hasFocus?.[0] === col && state.hasFocus?.[1] === row) {
        el.focus();
      }
    };

    gameBoard.set(row * state.width + col, square);

    const btn = button
      .type("button")
      .aria({ label: () => (square.isRevealed ? null : "Hidden") })
      .classes("btn", {
        revealed: () => square.isRevealed,
        flagged: () => square.isFlagged,
        ...range(8).reduce((classes, i) => {
          classes[`armed-adjacent-count--${i}`] = () =>
            square.armedAdjacentCount === i;

          return classes;
        }, {}),
      })
      .on("click touchend", revealSquare)
      .on("mousedown touchstart", toggleFlagDelayed)
      .on("contextmenu", toggleFlagImmediately)
      .on("keydown", moveFocus)
      .effect(focus)(() => {
        if (!square.isRevealed) {
          return square.isFlagged ? "🚩" : "";
        } else {
          return square.isFlagged && !square.isArmed
            ? "❌"
            : square.isArmed
            ? "💥"
            : square.armedAdjacentCount || "";
        }
      });

    return div.role("gridcell").aria({
      colindex: col + 1,
    })(btn);
  }

  function updateTime() {
    state.time = Math.floor((Date.now() - state.startTime) / 1000);
  }

  function getAdjacent(x, y) {
    const key = y * state.width + x;
    let result = adjacentMap.get(key);

    if (!result) {
      result = [];

      const bases = [y * state.width, (y + 1) * state.width];

      if (y > 0) {
        bases.push((y - 1) * state.width);
      }

      for (const base of bases) {
        if (x > 0) {
          result.push(base + x - 1);
        }

        result.push(base + x);

        if (x < state.width - 1) {
          result.push(base + x + 1);
        }
      }

      result = result.reduce((results, key) => {
        const square = gameBoard.get(key);

        if (square) {
          results.push(square);
        }

        return results;
      }, []);

      adjacentMap.set(key, result);
    }

    return result;
  }
});

function range(n) {
  return [...Array(n).keys()];
}
