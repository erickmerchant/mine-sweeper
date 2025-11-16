import { define, effect, h, shadow, watch } from "@handcraft/lib";

type Square = {
  x: number;
  y: number;
  isFlagged: boolean;
  isRevealed: boolean;
  isArmed: boolean;
  adjacent: Array<Square>;
  mouseDownStartTime: number;
  mouseDownTimeout?: number | null;
};

const { div, button } = h.html;

const PLAY_STATES = {
  PLAYING: 0,
  LOST: 1,
  WON: 2,
};

define("mine-sweeper").setup((host) => {
  const state: {
    playState: number;
    time: number;
    hasFocus: Array<number>;
    height: number;
    width: number;
    timeInterval?: number | null;
    startTime?: number | null;
    count: number;
    flags: number;
    hidden: number;
  } = watch({
    playState: PLAY_STATES.PLAYING,
    time: 0,
    hasFocus: [],
    height: 0,
    width: 0,
    count: 0,
    flags: 0,
    hidden: 0,
  });

  let gameBoard: Map<number, Square>;

  effect(() => {
    gameBoard = new Map();

    if (state.timeInterval) {
      clearInterval(state.timeInterval);
    }

    state.height = +(host.get("height") ?? 8);
    state.width = +(host.get("width") ?? 8);
    state.count = +(host.get("count") ?? 10);
    state.flags = state.count;
    state.hidden = state.height * state.width;

    state.playState = PLAY_STATES.PLAYING;
    state.time = 0;
    state.hasFocus = [];
    state.startTime = null;
    state.timeInterval = null;
  });

  const infoPanel = div.class("info-panel")(
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
      .class("grid")(
        ...range(state.height).map((row) =>
          div
            .aria({
              rowindex: row + 1,
            })
            .role("row")
            .class("row")(...range(state.width).map((col) => cell(row, col)))
        ),
      );

  host(
    shadow.css(() =>
      `:host { --width: ${state.width}; --height: ${state.height};`
    )(infoPanel, board),
  );

  function cell(row: number, col: number) {
    const square = watch<Square>({
      x: col,
      y: row,
      isFlagged: false,
      isRevealed: false,
      isArmed: false,
      adjacent: [],
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

            if (state.timeInterval) {
              clearInterval(state.timeInterval);
            }

            for (const square of gameBoard.values()) {
              if (!square.isFlagged || !square.isArmed) {
                square.isRevealed = true;
              }
            }
          } else {
            if (
              !square.isFlagged &&
              !square.adjacent.some((square) => square.isArmed)
            ) {
              let current = square.adjacent;

              do {
                const next = [];

                for (const sq of current) {
                  if (!sq || sq.isRevealed) {
                    continue;
                  }

                  if (
                    !sq.isArmed &&
                    !sq.isFlagged &&
                    !sq.isRevealed
                  ) {
                    sq.isRevealed = true;

                    state.hidden -= 1;

                    if (!sq.adjacent.some((square) => square.isArmed)) {
                      next.push(...sq.adjacent);
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

              if (state.timeInterval) {
                clearInterval(state.timeInterval);
              }
            }
          }
        }
      }

      square.mouseDownStartTime = Infinity;

      if (square.mouseDownTimeout) {
        clearTimeout(square.mouseDownTimeout);
      }
    };
    const toggleFlagDelayed = (e: Event) => {
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
    const toggleFlagImmediately = (e: Event) => {
      if (state.playState !== PLAY_STATES.PLAYING) {
        return;
      }

      e.preventDefault();

      if (!square.isRevealed) {
        square.isFlagged = !square.isFlagged;

        state.flags += square.isFlagged ? -1 : 1;
      }

      square.mouseDownStartTime = Infinity;

      if (square.mouseDownTimeout) {
        clearTimeout(square.mouseDownTimeout);
      }
    };
    const moveFocus = (e: KeyboardEvent) => {
      const keys: Record<string, Array<number>> = {
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
    const focus = (el: HTMLElement) => {
      if (state.hasFocus?.[0] === col && state.hasFocus?.[1] === row) {
        el.focus();
      }
    };

    gameBoard.set(row * state.width + col, square);

    const keys = [
      (row - 1) * state.width + col,
    ];

    if (col - 1 >= 0) {
      keys.push(
        (row - 1) * state.width + (col - 1),
        row * state.width + (col - 1),
      );
    }

    if (col + 1 <= state.width - 1) {
      keys.push((row - 1) * state.width + (col + 1));
    }

    for (const key of keys) {
      const adjacent = gameBoard.get(key);

      if (adjacent) {
        square.adjacent.push(adjacent);
        adjacent.adjacent.push(square);
      }
    }

    const btn = button
      .type("button")
      .aria({ label: () => (square.isRevealed ? null : "Hidden") })
      .class("btn", {
        revealed: () => square.isRevealed,
        flagged: () => square.isFlagged,
        ...range(8).reduce<Record<string, () => boolean>>((classes, i) => {
          classes[`armed-adjacent-count--${i}`] = () =>
            square.adjacent.filter((square) => square.isArmed).length === i;

          return classes;
        }, {}),
      })
      .on("click touchend", revealSquare)
      .on("mousedown touchstart", toggleFlagDelayed)
      .on("contextmenu", toggleFlagImmediately)
      .on("keydown", moveFocus as EventListener)
      .effect(focus)(() => {
        if (!square.isRevealed) {
          return square.isFlagged ? "🚩" : "";
        } else {
          return square.isFlagged && !square.isArmed
            ? "❌"
            : square.isArmed
            ? "💥"
            : `${
              square.adjacent.filter((square) => square.isArmed).length || ""
            }`;
        }
      });

    return div.role("gridcell").aria({
      colindex: col + 1,
    })(btn);
  }

  function updateTime() {
    state.time = state.startTime
      ? Math.floor((Date.now() - state.startTime) / 1000)
      : 0;
  }
});

function range(n: number): Array<number> {
  return [...Array(n).keys()];
}
