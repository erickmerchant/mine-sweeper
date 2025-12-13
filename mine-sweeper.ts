import { define, effect, h, observe, watch } from "@handcraft/lib";
import emButton from "./em-button.ts";

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

define("mine-sweeper").setup((host) => {
  const observed = observe(host);
  const height = () => observed.height ? Number(observed.height) : 8;
  const width = () => observed.width ? Number(observed.width) : 8;
  const count = () => observed.count ? Number(observed.count) : 10;
  const area = () => height() * width();
  const state = watch<GameState>({
    playState: PLAY_STATES.PLAYING,
    time: 0,
    hasFocus: [],
    flags: 0,
    hidden: 0,
  });

  let gameBoard: Map<number, Square>;

  effect(() => {
    gameBoard = new Map();

    if (state.timeInterval) {
      clearInterval(state.timeInterval);
    }

    state.flags = count();
    state.hidden = area();
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
        rowcount: height(),
        colcount: width(),
      })
      .role("grid")
      .class("grid")(
        ...range(height()).map((row) =>
          div
            .aria({
              rowindex: row + 1,
            })
            .role("row")
            .class("row")(
              ...range(width()).map((col) => cell(row, col, count())),
            )
        ),
      );

  host.shadow(
    { mode: "open" },
    style(() => `:host { --width: ${width()}; --height: ${height()};`),
    infoPanel,
    board,
  );

  function cell(row: number, col: number, _count: number) {
    const square = watch<Square>({
      x: col,
      y: row,
      isFlagged: false,
      isRevealed: false,
      isArmed: false,
      adjacent: [],
    });
    const arm = () => {
      let armed = [...gameBoard.values()].map((s) => ({
        square: s,
        order: s === square ? 2 : Math.random(),
      }));

      armed.sort((a, b) => a.order - b.order);

      armed = armed.splice(0, count());

      for (const { square } of armed) {
        square.isArmed = true;
      }

      state.playState = PLAY_STATES.PLAYING;

      state.startTime = Date.now();
      state.timeInterval = setInterval(updateTime, 250);
    };
    const revealSquare = () => {
      if (state.playState !== PLAY_STATES.PLAYING) {
        return;
      }

      if (state.hidden === area()) {
        arm();
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
    };
    const toggleFlagDelayed = (e: Event) => {
      if (state.playState !== PLAY_STATES.PLAYING) {
        return;
      }

      e.preventDefault();

      if (!square.isRevealed) {
        square.isFlagged = !square.isFlagged;

        state.flags += square.isFlagged ? -1 : 1;
      }
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

    return div.role("gridcell").aria({
      colindex: col + 1,
    })(
      emButton(
        button
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
          .on("leftclick", revealSquare)
          .on("longclick", toggleFlagDelayed)
          .on("rightclick", toggleFlagImmediately)
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
                  square.adjacent.filter((square) => square.isArmed).length ||
                  ""
                }`;
            }
          }),
      ),
    );
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
