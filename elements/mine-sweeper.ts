import type { HandcraftNode, HandcraftTag } from "@handcraft/lib/types";
import { watch } from "@handcraft/lib/reactivity";
import { HandcraftElementWithAttributes } from "@handcraft/lib/element";
import html from "@handcraft/lib/html";
import attr from "@handcraft/lib/attr";
import aria from "@handcraft/lib/aria";
import on from "@handcraft/lib/on";
import effect from "@handcraft/lib/effect";
import tokens from "@handcraft/lib/tokens";
import text from "@handcraft/lib/text";
import shadow from "@handcraft/lib/shadow";

const IS_ARMED = 0b001;
const IS_REVEALED = 0b010;
const IS_FLAGGED = 0b100;

type Square = {
  x: number;
  y: number;
  squareState: number;
  adjacent: Array<Square>;
};

function squareIs(square: Square, mask: number) {
  return !!(square.squareState & mask);
}

function squareAdjacentCount(square: Square, mask: number) {
  return square.adjacent.filter((a) => a.squareState & mask).length;
}

const PLAY_STATES = {
  PLAYING: 0,
  LOST: 1,
  WON: 2,
};

type Attributes = {
  height: number;
  width: number;
  count: number;
};

export class MineSweeper extends HandcraftElementWithAttributes {
  override get defaults(): Attributes {
    return {
      height: 8,
      width: 8,
      count: 10,
    };
  }

  override view(host: HandcraftTag, attributes: Attributes): HandcraftNode {
    const state: {
      playState: number;
      time: number;
      hasFocus: Array<number>;
      flags: number;
      hiddenCount: number;
    } = watch({
      playState: PLAY_STATES.PLAYING,
      time: 0,
      hasFocus: [],
      flags: 0,
      hiddenCount: 0,
    });

    let timeInterval: number | null = null;
    let startTime: number | null = null;

    const gameBoard: Map<number, Square> = new Map();

    const cell = (row: number, col: number): HandcraftNode => {
      const square = watch<Square>({
        x: col,
        y: row,
        squareState: 0,
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

          this.timeout = setTimeout(cb, 1000) as unknown as number;

          this.start = Date.now();
        },
        cancel(cb: () => void) {
          if (!this.triggered) {
            cb();

            this.clear();
          }
        },
      };

      gameBoard.set(row * attributes.width + col, square);

      const keys = [
        (row - 1) * attributes.width + col,
      ];

      if (col - 1 >= 0) {
        keys.push(
          (row - 1) * attributes.width + (col - 1),
          row * attributes.width + (col - 1),
        );
      }

      if (col + 1 <= attributes.width - 1) {
        keys.push((row - 1) * attributes.width + (col + 1));
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

        armed = armed.splice(0, attributes.count);

        for (const { square } of armed) {
          square.squareState |= IS_ARMED;
        }

        state.playState = PLAY_STATES.PLAYING;

        startTime = Date.now();
        timeInterval = setInterval(
          (): void => {
            state.time = startTime
              ? Math.floor((Date.now() - startTime) / 1_000)
              : 0;
          },
          250,
        ) as unknown as number;
      };

      const revealSquare = () => {
        if (state.playState !== PLAY_STATES.PLAYING) {
          return;
        }

        if (state.hiddenCount === attributes.height * attributes.width) {
          arm();
        }

        longPress.cancel(() => {
          if (!squareIs(square, IS_FLAGGED | IS_REVEALED)) {
            square.squareState |= IS_REVEALED;

            state.hiddenCount -= 1;

            if (squareIs(square, IS_ARMED)) {
              state.playState = PLAY_STATES.LOST;

              if (timeInterval) {
                clearInterval(timeInterval);
              }

              for (const square of gameBoard.values()) {
                square.squareState |= IS_REVEALED;
              }
            } else {
              if (
                !squareIs(square, IS_FLAGGED) &&
                squareAdjacentCount(square, IS_ARMED) === 0
              ) {
                let current = square.adjacent;

                do {
                  const next = [];

                  for (const sq of current) {
                    if (!sq || squareIs(sq, IS_REVEALED)) {
                      continue;
                    }

                    if (
                      !sq.squareState
                    ) {
                      sq.squareState |= IS_REVEALED;

                      state.hiddenCount -= 1;

                      if (squareAdjacentCount(sq, IS_ARMED) === 0) {
                        next.push(...sq.adjacent);
                      }
                    }
                  }

                  current = next;
                } while (current.length > 0);
              }

              if (state.hiddenCount === attributes.count) {
                state.playState = PLAY_STATES.WON;

                for (const square of gameBoard.values()) {
                  if (!squareIs(square, IS_FLAGGED)) {
                    if (squareIs(square, IS_ARMED)) {
                      square.squareState |= IS_FLAGGED;
                    } else {
                      square.squareState |= IS_REVEALED;
                    }
                  }
                }

                state.flags = 0;

                if (timeInterval) {
                  clearInterval(timeInterval);
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

          if (!squareIs(square, IS_REVEALED)) {
            square.squareState ^= IS_FLAGGED;

            state.flags += squareIs(square, IS_FLAGGED) ? -1 : 1;
          }
        });
      };

      const toggleFlagImmediately = (e: Event) => {
        e.preventDefault();

        if (state.playState !== PLAY_STATES.PLAYING) {
          return;
        }

        longPress.cancel(() => {
          if (!squareIs(square, IS_REVEALED)) {
            square.squareState ^= IS_FLAGGED;

            state.flags += squareIs(square, IS_FLAGGED) ? -1 : 1;
          }
        });
      };

      const moveFocus = (e: KeyboardEvent) => {
        const keys: Record<string, Array<number>> = {
          ArrowUp: row > 0 ? [col, row - 1] : [],
          ArrowDown: row < attributes.height - 1 ? [col, row + 1] : [],
          ArrowLeft: col > 0
            ? [col - 1, row]
            : row > 0
            ? [attributes.width - 1, row - 1]
            : [],
          ArrowRight: col < attributes.width - 1
            ? [col + 1, row]
            : row < attributes.height - 1
            ? [0, row + 1]
            : [],
        };

        state.hasFocus = keys?.[e.key] ?? [];
      };

      const focus = (el: HTMLElement) => {
        if (
          state.hasFocus?.[0] === col && state.hasFocus?.[1] === row
        ) {
          el.focus();
        }
      };

      return html.div(
        attr.role("gridcell"),
        attr.style(() =>
          `--armed-adjacent-count: ${squareAdjacentCount(square, IS_ARMED)}`
        ),
        aria.colindex(col + 1),
        html.button(
          on.click(revealSquare),
          on.touchend(revealSquare),
          on.mousedown(toggleFlagDelayed),
          on.touchstart(toggleFlagDelayed),
          on.contextmenu(toggleFlagImmediately),
          on.keydown(moveFocus as EventListener),
          aria.label(
            () => (squareIs(square, IS_REVEALED) ? null : "Hidden"),
          ),
          attr.type("button"),
          attr.part(tokens({
            btn: true,
            revealed: () => squareIs(square, IS_REVEALED),
            flagged: () => squareIs(square, IS_FLAGGED),
          })),
          effect(focus),
          text(() => {
            const [armed, flagged, revealed] = [
              squareIs(square, IS_ARMED),
              squareIs(square, IS_FLAGGED),
              squareIs(square, IS_REVEALED),
            ];

            if (!revealed && flagged) return "🚩";
            if (!revealed) return "";

            if (flagged && !armed) return "❌";
            if (armed) return "💥";

            return "" + (squareAdjacentCount(square, IS_ARMED) || "");
          }),
        ),
      );
    };

    state.flags = attributes.count;
    state.hiddenCount = attributes.height * attributes.width;
    state.playState = PLAY_STATES.PLAYING;
    state.time = 0;
    state.hasFocus = [];
    startTime = null;
    timeInterval = null;

    return host(
      shadow(
        { mode: "open" },
        html.style(
          text(() =>
            `:host { --width: ${attributes.width}; --height: ${attributes.height}; }`
          ),
        ),
        html.div(
          attr.part("info-panel"),
          html.div(text(() => `🚩 ${state.flags}`)),
          html.div(
            aria.live("polite"),
            text(() => ["", "💀", "🎉"][state.playState]),
          ),
          html.div(text(() => `${state.time} ⏱️`)),
        ),
        html.div(
          aria.rowcount(attributes.height),
          aria.colcount(attributes.width),
          attr.role("grid"),
          attr.part("grid"),
          ...range(attributes.height).map((row) =>
            html.div(
              aria.rowindex(row + 1),
              attr.role("row"),
              attr.part("row"),
              ...range(attributes.width).map((col) => cell(row, col)),
            )
          ),
        ),
      ),
    );
  }
}

export default MineSweeper.define("mine-sweeper") as HandcraftTag;

function range(n: number): Array<number> {
  return [...Array(n).keys()];
}
