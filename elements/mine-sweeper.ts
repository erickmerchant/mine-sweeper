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

type Square = {
  x: number;
  y: number;
  isFlagged: boolean;
  isRevealed: boolean;
  isArmed: boolean;
  adjacent: Array<Square>;
};

const PLAY_STATES = {
  PLAYING: 0,
  LOST: 1,
  WON: 2,
};

export class MineSweeper extends HandcraftElementWithAttributes {
  static observedAttributes = ["height", "width", "count"];

  override state: {
    height: number;
    width: number;
    count: number;
    playState: number;
    time: number;
    hasFocus: Array<number>;
    flags: number;
    hiddenCount: number;
  } = watch({
    height: 8,
    width: 8,
    count: 10,
    playState: PLAY_STATES.PLAYING,
    time: 0,
    hasFocus: [],
    flags: 0,
    hiddenCount: 0,
  });

  timeInterval?: number | null = null;
  startTime?: number | null = null;

  gameBoard: Map<number, Square> = new Map();

  cell(row: number, col: number): HandcraftNode {
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

    this.gameBoard.set(row * this.state.width + col, square);

    const keys = [
      (row - 1) * this.state.width + col,
    ];

    if (col - 1 >= 0) {
      keys.push(
        (row - 1) * this.state.width + (col - 1),
        row * this.state.width + (col - 1),
      );
    }

    if (col + 1 <= this.state.width - 1) {
      keys.push((row - 1) * this.state.width + (col + 1));
    }

    for (const key of keys) {
      const adjacent = this.gameBoard.get(key);

      if (adjacent) {
        square.adjacent.push(adjacent);
        adjacent.adjacent.push(square);
      }
    }

    const arm = () => {
      const values = [...this.gameBoard.values()];
      const orders = new Uint32Array(values.length);

      globalThis.crypto.getRandomValues(orders);

      let armed = values.map((s, i) => ({
        square: s,
        order: s === square
          ? 2
          : orders[i] / 0b11111111111111111111111111111111,
      }));

      armed.sort((a, b) => a.order - b.order);

      armed = armed.splice(0, this.state.count);

      for (const { square } of armed) {
        square.isArmed = true;
      }

      this.state.playState = PLAY_STATES.PLAYING;

      this.startTime = Date.now();
      this.timeInterval = setInterval(
        this.updateTime,
        250,
      ) as unknown as number;
    };

    const revealSquare = () => {
      if (this.state.playState !== PLAY_STATES.PLAYING) {
        return;
      }

      if (this.state.hiddenCount === this.state.height * this.state.width) {
        arm();
      }

      longPress.cancel(() => {
        if (!square.isFlagged && !square.isRevealed) {
          square.isRevealed = true;

          this.state.hiddenCount -= 1;

          if (square.isArmed) {
            this.state.playState = PLAY_STATES.LOST;

            if (this.timeInterval) {
              clearInterval(this.timeInterval);
            }

            for (const square of this.gameBoard.values()) {
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

                    this.state.hiddenCount -= 1;

                    if (!sq.adjacent.some((square) => square.isArmed)) {
                      next.push(...sq.adjacent);
                    }
                  }
                }

                current = next;
              } while (current.length > 0);
            }

            if (this.state.hiddenCount === this.state.count) {
              this.state.playState = PLAY_STATES.WON;

              for (const square of this.gameBoard.values()) {
                if (!square.isFlagged) {
                  if (square.isArmed) {
                    square.isFlagged = true;
                  } else {
                    square.isRevealed = true;
                  }
                }
              }

              this.state.flags = 0;

              if (this.timeInterval) {
                clearInterval(this.timeInterval);
              }
            }
          }
        }
      });
    };

    const toggleFlagDelayed = () => {
      longPress.schedule(() => {
        if (this.state.playState !== PLAY_STATES.PLAYING) {
          return;
        }

        if (!square.isRevealed) {
          square.isFlagged = !square.isFlagged;

          this.state.flags += square.isFlagged ? -1 : 1;
        }
      });
    };

    const toggleFlagImmediately = (e: Event) => {
      e.preventDefault();

      if (this.state.playState !== PLAY_STATES.PLAYING) {
        return;
      }

      longPress.cancel(() => {
        if (!square.isRevealed) {
          square.isFlagged = !square.isFlagged;

          this.state.flags += square.isFlagged ? -1 : 1;
        }
      });
    };

    const moveFocus = (e: KeyboardEvent) => {
      const keys: Record<string, Array<number>> = {
        ArrowUp: row > 0 ? [col, row - 1] : [],
        ArrowDown: row < this.state.height - 1 ? [col, row + 1] : [],
        ArrowLeft: col > 0
          ? [col - 1, row]
          : row > 0
          ? [this.state.width - 1, row - 1]
          : [],
        ArrowRight: col < this.state.width - 1
          ? [col + 1, row]
          : row < this.state.height - 1
          ? [0, row + 1]
          : [],
      };

      this.state.hasFocus = keys?.[e.key] ?? [];
    };

    const focus = (el: HTMLElement) => {
      if (
        this.state.hasFocus?.[0] === col && this.state.hasFocus?.[1] === row
      ) {
        el.focus();
      }
    };

    return html.div(
      attr.role("gridcell"),
      aria.colindex(col + 1),
      html.button(
        on.click(revealSquare),
        on.touchend(revealSquare),
        on.mousedown(toggleFlagDelayed),
        on.touchstart(toggleFlagDelayed),
        on.contextmenu(toggleFlagImmediately),
        on.keydown(moveFocus as EventListener),
        aria.label(() => (square.isRevealed ? null : "Hidden")),
        attr.type("button"),
        attr.part(tokens({
          btn: true,
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
        })),
        effect(focus),
        text(() => {
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
      ),
    );
  }

  updateTime = (): void => {
    this.state.time = this.startTime
      ? Math.floor((Date.now() - this.startTime) / 1_000)
      : 0;
  };

  override view(host: HandcraftTag): HandcraftNode {
    this.state.flags = this.state.count;
    this.state.hiddenCount = this.state.height * this.state.width;
    this.state.playState = PLAY_STATES.PLAYING;
    this.state.time = 0;
    this.state.hasFocus = [];
    this.startTime = null;
    this.timeInterval = null;

    return host(
      shadow(
        { mode: "open" },
        html.style(
          text(() =>
            `:host { --width: ${this.state.width}; --height: ${this.state.height}; }`
          ),
        ),
        html.div(
          attr.part("info-panel"),
          html.div(text(() => `🚩 ${this.state.flags}`)),
          html.div(
            aria.live("polite"),
            text(() => ["", "💀", "🎉"][this.state.playState]),
          ),
          html.div(text(() => `${this.state.time} ⏱️`)),
        ),
        html.div(
          aria.rowcount(this.state.height),
          aria.colcount(this.state.width),
          attr.role("grid"),
          attr.part("grid"),
          ...range(this.state.height).map((row) =>
            html.div(
              aria.rowindex(row + 1),
              attr.role("row"),
              attr.part("row"),
              ...range(this.state.width).map((col) => this.cell(row, col)),
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
