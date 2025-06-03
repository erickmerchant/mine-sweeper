import "handcraft/dom/aria.js";
import "handcraft/dom/classes.js";
import "handcraft/dom/css.js";
import "handcraft/dom/effect.js";
import "handcraft/dom/observe.js";
import "handcraft/dom/on.js";
import "handcraft/dom/shadow.js";
import {h} from "handcraft/dom.js";
import {watch, effect} from "handcraft/reactivity.js";
import {define} from "handcraft/define.js";

let {div, button} = h.html;

const PLAY_STATES = {
	PLAYING: 0,
	LOST: 1,
	WON: 2,
};

define("mine-sweeper").connected((host) => {
	let observed = host.observe();

	effect(() => {
		let height = +observed.attr("height");
		let width = +observed.attr("width");
		let mineCount = +observed.attr("mine-count");
		let state = watch({
			playState: PLAY_STATES.PLAYING,
			time: 0,
			flagCount: mineCount,
			hasFocus: [],
		});
		let startTime = null;
		let timeInterval = null;
		let hiddenCount = height * width;
		let gameBoard = new Map();
		let adjacentMap = new Map();
		let infoPanel = div.classes("info-panel")(
			div(() => `🚩 ${state.flagCount}`),
			div.aria({live: "polite"})(() => ["", "💀", "🎉"][state.playState]),
			div(() => `${state.time} ⏱️`)
		);
		let board = div
			.aria({
				rowcount: height,
				colcount: width,
			})
			.classes("grid")
			.role("grid")(
			range(height).map((row) =>
				div
					.classes("row")
					.role("row")
					.aria({
						rowindex: row + 1,
					})(range(width).map((col) => cell(row, col)))
			)
		);
		let shadow = host.shadow();

		shadow.css(`:host {
			--width: ${width};
			--height: ${height};
		`);

		shadow(infoPanel, board);

		function cell(row, col) {
			let square = watch({
				x: col,
				y: row,
				isFlagged: false,
				isRevealed: false,
				isArmed: false,
				armedAdjacentCount: 0,
				mouseDownStartTime: Infinity,
				mouseDownTimeout: null,
			});
			let revealSquare = () => {
				let square = gameBoard.get(row * width + col);

				if (Date.now() - square.mouseDownStartTime < 1_000) {
					if (state.playState !== PLAY_STATES.PLAYING) {
						return;
					}

					if (hiddenCount === height * width) {
						let armed = [...gameBoard.values()].map((s) => ({
							square: s,
							order: s === square ? 2 : Math.random(),
						}));

						armed.sort((a, b) => a.order - b.order);

						armed = armed.splice(0, mineCount);

						for (let {square} of armed) {
							square.isArmed = true;

							for (let adjacent of getAdjacent(square.x, square.y)) {
								adjacent.armedAdjacentCount += 1;
							}
						}

						state.playState = PLAY_STATES.PLAYING;

						startTime = Date.now();
						timeInterval = setInterval(updateTime, 250);
					}

					if (!square.isFlagged && !square.isRevealed) {
						square.isRevealed = true;

						hiddenCount -= 1;

						if (square.isArmed) {
							state.playState = PLAY_STATES.LOST;

							clearInterval(timeInterval);

							for (let square of gameBoard.values()) {
								if (!square.isFlagged || !square.isArmed) {
									square.isRevealed = true;
								}
							}
						} else {
							if (!square.isFlagged && square.armedAdjacentCount === 0) {
								let current = getAdjacent(col, row);

								do {
									let next = [];

									for (let square of current) {
										if (!square || square.isRevealed) {
											continue;
										}

										if (
											!square.isArmed &&
											!square.isFlagged &&
											!square.isRevealed
										) {
											square.isRevealed = true;

											hiddenCount -= 1;

											if (square.armedAdjacentCount === 0) {
												next.push(...getAdjacent(square.x, square.y));
											}
										}
									}

									current = next;
								} while (current.length > 0);
							}

							if (hiddenCount === mineCount) {
								state.playState = PLAY_STATES.WON;

								for (let square of gameBoard.values()) {
									if (!square.isFlagged) {
										if (square.isArmed) {
											square.isFlagged = true;
										} else {
											square.isRevealed = true;
										}
									}
								}

								state.flagCount = 0;

								clearInterval(timeInterval);
							}
						}
					}
				}

				square.mouseDownStartTime = Infinity;

				clearTimeout(square.mouseDownTimeout);
			};
			let toggleFlagDelayed = (e) => {
				if (state.playState !== PLAY_STATES.PLAYING) {
					return;
				}

				let square = gameBoard.get(row * width + col);

				e.preventDefault();

				square.mouseDownStartTime = Date.now();

				square.mouseDownTimeout = setTimeout(() => {
					if (!square.isRevealed) {
						square.isFlagged = !square.isFlagged;

						state.flagCount += square.isFlagged ? -1 : 1;
					}
				}, 1_000);
			};
			let toggleFlagImmediately = (e) => {
				if (state.playState !== PLAY_STATES.PLAYING) {
					return;
				}

				let square = gameBoard.get(row * width + col);

				e.preventDefault();

				if (!square.isRevealed) {
					square.isFlagged = !square.isFlagged;

					state.flagCount += square.isFlagged ? -1 : 1;
				}

				square.mouseDownStartTime = Infinity;

				clearTimeout(square.mouseDownTimeout);
			};
			let moveFocus = (e) => {
				let keys = {
					ArrowUp: row > 0 ? [col, row - 1] : [],
					ArrowDown: row < height - 1 ? [col, row + 1] : [],
					ArrowLeft:
						col > 0 ? [col - 1, row] : row > 0 ? [width - 1, row - 1] : [],
					ArrowRight:
						col < width - 1
							? [col + 1, row]
							: row < height - 1
							? [0, row + 1]
							: [],
				};

				state.hasFocus = keys?.[e.key] ?? [];
			};
			let focus = (el) => {
				if (state.hasFocus?.[0] === col && state.hasFocus?.[1] === row) {
					el.focus();
				}
			};

			gameBoard.set(row * width + col, square);

			let btn = button
				.type("button")
				.aria({label: () => (square.isRevealed ? null : "Hidden")})
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
			state.time = Math.floor((Date.now() - startTime) / 1000);
		}

		function getAdjacent(x, y) {
			let key = y * width + x;
			let result = adjacentMap.get(key);

			if (!result) {
				result = [];

				let bases = [y * width, (y + 1) * width];

				if (y > 0) {
					bases.push((y - 1) * width);
				}

				for (let base of bases) {
					if (x > 0) {
						result.push(base + x - 1);
					}

					result.push(base + x);

					if (x < width - 1) {
						result.push(base + x + 1);
					}
				}

				result = result.reduce((results, key) => {
					let square = gameBoard.get(key);

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
});

function range(n) {
	return [...Array(n).keys()];
}
