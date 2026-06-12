import {
  effect,
  h,
  HandcraftElement,
  HandcraftNode,
  watch,
} from "@handcraft/lib";

type Square = {
  x: number;
  y: number;
  isFlagged: boolean;
  isRevealed: boolean;
  isArmed: boolean;
  adjacent: Array<Square>;
};

type GameState = {
  playState: number;
  time: number;
  hasFocus: Array<number>;
  timeInterval?: number | null;
  startTime?: number | null;
  flags: number;
  hidden: number;
};

const { div, style, button } = h.html;

const PLAY_STATES = {
  PLAYING: 0,
  LOST: 1,
  WON: 2,
};

export class MineSweeper extends HandcraftElement {
  height = 8;
  width = 8;
  count = 10;

  override view(host: HandcraftNode) {
    const height = () => this.height;
    const width = () => this.width;
    const count = () => this.count;
    const area = () => height() * width();
    const state = watch<GameState>({
      playState: PLAY_STATES.PLAYING,
      time: 0,
      hasFocus: [],
      flags: 0,
      hidden: 0,
    });

    const gameBoard: Map<number, Square> = new Map();

    state.flags = count();
    state.hidden = area();
    state.playState = PLAY_STATES.PLAYING;
    state.time = 0;
    state.hasFocus = [];
    state.startTime = null;
    state.timeInterval = null;

    effect(() => {
      if (state.timeInterval) {
        clearInterval(state.timeInterval);
      }
    });

    const cell = (row: number, col: number) => {
      const square = watch<Square>({
        x: col,
        y: row,
        isFlagged: false,
        isRevealed: false,
        isArmed: false,

        adjacent: [],
      });

      const longPress: {
        timeout: number | null;
        start: number;
        triggered: boolean;
        clear: () => void;
        schedule: (cb: () => void) => void;
        cancel: (cb: () => void) => void;
      } = {
        timeout: null,
        start: 0,
        get triggered() {
          return Date.now() - this.start >= 1000;
        },
        clear() {
          if (this.timeout) clearTimeout(this.timeout);
        },
        schedule(cb: () => void) {
          this.clear();

          this.timeout = setTimeout(cb, 1000);

          this.start = Date.now();
        },
        cancel(cb: () => void) {
          if (!this.triggered) {
            cb();

            this.clear();
          }
        },
      };

      gameBoard.set(row * width() + col, square);

      const keys = [
        (row - 1) * width() + col,
      ];

      if (col - 1 >= 0) {
        keys.push(
          (row - 1) * width() + (col - 1),
          row * width() + (col - 1),
        );
      }

      if (col + 1 <= width() - 1) {
        keys.push((row - 1) * width() + (col + 1));
      }

      for (const key of keys) {
        const adjacent = gameBoard.get(key);

        if (adjacent) {
          square.adjacent.push(adjacent);
          adjacent.adjacent.push(square);
        }
      }

      const arm = () => {
        const values = [...gameBoard.values()];
        const orders = new Uint32Array(values.length);

        globalThis.crypto.getRandomValues(orders);

        let armed = values.map((s, i) => ({
          square: s,
          order: s === square
            ? 2
            : orders[i] / 0b11111111111111111111111111111111,
        }));

        armed.sort((a, b) => a.order - b.order);

        armed = armed.splice(0, count());

        for (const { square } of armed) {
          square.isArmed = true;
        }

        state.playState = PLAY_STATES.PLAYING;

        state.startTime = Date.now();
        state.timeInterval = setInterval(updateTime, 250) as unknown as number;
      };

      const revealSquare = () => {
        if (state.playState !== PLAY_STATES.PLAYING) {
          return;
        }

        if (state.hidden === area()) {
          arm();
        }

        longPress.cancel(() => {
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

              if (state.hidden === count()) {
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
        });
      };

      const toggleFlagDelayed = () => {
        longPress.schedule(() => {
          if (state.playState !== PLAY_STATES.PLAYING) {
            return;
          }

          if (!square.isRevealed) {
            square.isFlagged = !square.isFlagged;

            state.flags += square.isFlagged ? -1 : 1;
          }
        });
      };

      const toggleFlagImmediately = (e: Event) => {
        e.preventDefault();

        if (state.playState !== PLAY_STATES.PLAYING) {
          return;
        }

        longPress.cancel(() => {
          if (!square.isRevealed) {
            square.isFlagged = !square.isFlagged;

            state.flags += square.isFlagged ? -1 : 1;
          }
        });
      };

      const moveFocus = (e: KeyboardEvent) => {
        const keys: Record<string, Array<number>> = {
          ArrowUp: row > 0 ? [col, row - 1] : [],
          ArrowDown: row < height() - 1 ? [col, row + 1] : [],
          ArrowLeft: col > 0
            ? [col - 1, row]
            : row > 0
            ? [width() - 1, row - 1]
            : [],
          ArrowRight: col < width() - 1
            ? [col + 1, row]
            : row < height() - 1
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

      return div.role("gridcell").aria("colindex", col + 1)(
        button.on("click touchend", revealSquare)
          .on("mousedown touchstart", toggleFlagDelayed)
          .on("contextmenu", toggleFlagImmediately)
          .on("keydown", moveFocus as EventListener)
          .type("button")
          .aria("label", () => (square.isRevealed ? null : "Hidden"))
          .part("btn", {
            revealed: () => square.isRevealed,
            flagged: () => square.isFlagged,
            ...range(8).reduce<Record<string, () => boolean>>(
              (classes, i) => {
                classes[`armed-adjacent-count--${i}`] = () =>
                  square.adjacent.filter((square) => square.isArmed)
                    .length === i;

                return classes;
              },
              {},
            ),
          })
          .effect(focus)(() => {
            if (!square.isRevealed) {
              return square.isFlagged ? "🚩" : "";
            } else {
              return square.isFlagged && !square.isArmed
                ? "❌"
                : square.isArmed
                ? "💥"
                : `${
                  square.adjacent.filter((square) => square.isArmed)
                    .length ||
                  ""
                }`;
            }
          }),
      );
    };

    const updateTime = () => {
      state.time = state.startTime
        ? Math.floor((Date.now() - state.startTime) / 1_000)
        : 0;
    };

    host.shadow({ mode: "open" }, [
      style(() => `:host { --width: ${width()}; --height: ${height()}; }`),
      div.part("info-panel")(
        div(() => `🚩 ${state.flags}`),
        div.aria("live", "polite")(() => ["", "💀", "🎉"][state.playState]),
        div(() => `${state.time} ⏱️`),
      ),
      div
        .aria("rowcount", height())
        .aria("colcount", width())
        .role("grid")
        .part("grid")(
          ...range(height()).map((row) =>
            div
              .aria("rowindex", row + 1)
              .role("row")
              .part("row")(
                ...range(width()).map((col) => cell(row, col)),
              )
          ),
        ),
    ]);
  }
}

export default MineSweeper.define("mine-sweeper");

function range(n: number): Array<number> {
  return [...Array(n).keys()];
}
