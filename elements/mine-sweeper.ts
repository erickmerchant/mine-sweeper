import { h, HandcraftElement, type HandcraftNode, watch } from "@handcraft/lib";

type Square = {
  x: number;
  y: number;
  isFlagged: boolean;
  isRevealed: boolean;
  isArmed: boolean;
  adjacent: Array<Square>;
};

const { div, style, button } = h.html;

const PLAY_STATES = {
  PLAYING: 0,
  LOST: 1,
  WON: 2,
};

export class MineSweeper extends HandcraftElement {
  static observedAttributes = ["height", "width", "count"];
  static observedProperties = [
    "playState",
    "time",
    "hasFocus",
    "flags",
    "hiddenCount",
  ];

  height = 8;
  width = 8;
  count = 10;

  playState: number = PLAY_STATES.PLAYING;
  time: number = 0;
  hasFocus: Array<number> = [];
  timeInterval?: number | null = null;
  startTime?: number | null = null;
  flags: number = 0;
  hiddenCount: number = 0;

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

    this.gameBoard.set(row * this.width + col, square);

    const keys = [
      (row - 1) * this.width + col,
    ];

    if (col - 1 >= 0) {
      keys.push(
        (row - 1) * this.width + (col - 1),
        row * this.width + (col - 1),
      );
    }

    if (col + 1 <= this.width - 1) {
      keys.push((row - 1) * this.width + (col + 1));
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

      armed = armed.splice(0, this.count);

      for (const { square } of armed) {
        square.isArmed = true;
      }

      this.playState = PLAY_STATES.PLAYING;

      this.startTime = Date.now();
      this.timeInterval = setInterval(
        this.updateTime,
        250,
      ) as unknown as number;
    };

    const revealSquare = () => {
      if (this.playState !== PLAY_STATES.PLAYING) {
        return;
      }

      if (this.hiddenCount === this.height * this.width) {
        arm();
      }

      longPress.cancel(() => {
        if (!square.isFlagged && !square.isRevealed) {
          square.isRevealed = true;

          this.hiddenCount -= 1;

          if (square.isArmed) {
            this.playState = PLAY_STATES.LOST;

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

                    this.hiddenCount -= 1;

                    if (!sq.adjacent.some((square) => square.isArmed)) {
                      next.push(...sq.adjacent);
                    }
                  }
                }

                current = next;
              } while (current.length > 0);
            }

            if (this.hiddenCount === this.count) {
              this.playState = PLAY_STATES.WON;

              for (const square of this.gameBoard.values()) {
                if (!square.isFlagged) {
                  if (square.isArmed) {
                    square.isFlagged = true;
                  } else {
                    square.isRevealed = true;
                  }
                }
              }

              this.flags = 0;

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
        if (this.playState !== PLAY_STATES.PLAYING) {
          return;
        }

        if (!square.isRevealed) {
          square.isFlagged = !square.isFlagged;

          this.flags += square.isFlagged ? -1 : 1;
        }
      });
    };

    const toggleFlagImmediately = (e: Event) => {
      e.preventDefault();

      if (this.playState !== PLAY_STATES.PLAYING) {
        return;
      }

      longPress.cancel(() => {
        if (!square.isRevealed) {
          square.isFlagged = !square.isFlagged;

          this.flags += square.isFlagged ? -1 : 1;
        }
      });
    };

    const moveFocus = (e: KeyboardEvent) => {
      const keys: Record<string, Array<number>> = {
        ArrowUp: row > 0 ? [col, row - 1] : [],
        ArrowDown: row < this.height - 1 ? [col, row + 1] : [],
        ArrowLeft: col > 0
          ? [col - 1, row]
          : row > 0
          ? [this.width - 1, row - 1]
          : [],
        ArrowRight: col < this.width - 1
          ? [col + 1, row]
          : row < this.height - 1
          ? [0, row + 1]
          : [],
      };

      this.hasFocus = keys?.[e.key] ?? [];
    };

    const focus = (el: HTMLElement) => {
      if (
        this.hasFocus?.[0] === col && this.hasFocus?.[1] === row
      ) {
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
  }

  updateTime = (): void => {
    this.time = this.startTime
      ? Math.floor((Date.now() - this.startTime) / 1_000)
      : 0;
  };

  override view(host: HandcraftNode) {
    this.flags = this.count;
    this.hiddenCount = this.height * this.width;
    this.playState = PLAY_STATES.PLAYING;
    this.time = 0;
    this.hasFocus = [];
    this.startTime = null;
    this.timeInterval = null;

    host.shadow({ mode: "open" }, [
      style(() =>
        `:host { --width: ${this.width}; --height: ${this.height}; }`
      ),
      div.part("info-panel")(
        div(() => `🚩 ${this.flags}`),
        div.aria("live", "polite")(() => ["", "💀", "🎉"][this.playState]),
        div(() => `${this.time} ⏱️`),
      ),
      div
        .aria("rowcount", this.height)
        .aria("colcount", this.width)
        .role("grid")
        .part("grid")(
          ...range(this.height).map((row) =>
            div
              .aria("rowindex", row + 1)
              .role("row")
              .part("row")(
                ...range(this.width).map((col) => this.cell(row, col)),
              )
          ),
        ),
    ]);
  }
}

export default MineSweeper.define("mine-sweeper") as HandcraftNode;

function range(n: number): Array<number> {
  return [...Array(n).keys()];
}
