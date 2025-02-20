import {html} from "handcraft/dom.js";
import {watch, effect} from "handcraft/reactivity.js";
import {define} from "handcraft/define.js";
import "handcraft/element/aria.js";
import "handcraft/element/attr.js";
import "handcraft/element/classes.js";
import "handcraft/element/effect.js";
import "handcraft/element/nodes.js";
import "handcraft/element/observe.js";
import "handcraft/element/on.js";
import "handcraft/element/shadow.js";
import "handcraft/element/styles.js";
import "handcraft/element/text.js";

let {div: DIV, button: BUTTON} = html;

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

		let infoPanel = DIV()
			.classes("info-panel")
			.nodes(
				DIV().text(() => `🚩 ${state.flagCount}`),
				DIV()
					.aria({live: "polite"})
					.text(() => ["", "💀", "🎉"][state.playState]),
				DIV().text(() => `⏱️ ${state.time}`)
			);
		let board = DIV()
			.aria({
				rowcount: height,
				colcount: width,
			})
			.attr("role", "grid")
			.nodes(
				range(height).map((row) =>
					DIV()
						.attr("role", "row")
						.aria({
							rowindex: row + 1,
						})
						.nodes(range(width).map((col) => cell(row, col)))
				)
			);

		host.styles({
			"--width": width,
			"--height": height,
		});

		let shadow = host.shadow();

		shadow.nodes(infoPanel, board);

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

			gameBoard.set(`${col} ${row}`, square);

			let btn = BUTTON()
				.attr("type", "button")
				.styles({
					"--column": col + 1,
					"--row": row + 1,
				})
				.aria({label: () => (square.isRevealed ? null : "Hidden")})
				.classes({
					revealed: () => square.isRevealed,
					flagged: () => square.isFlagged,
					...range(8).reduce((classes, i) => {
						classes[`armed-adjacent-count--${i}`] = () =>
							square.armedAdjacentCount === i;

						return classes;
					}, {}),
				})
				.text(() => {
					if (!square.isRevealed) {
						return square.isFlagged ? "🚩" : "";
					} else {
						return square.isFlagged && !square.isArmed
							? "❌"
							: square.isArmed
							? "💥"
							: square.armedAdjacentCount || "";
					}
				})
				.on("click", revealSquare(col, row))
				.on("touchend", revealSquare(col, row))
				.on("mousedown", toggleFlagDelayed(col, row))
				.on("touchstart", toggleFlagDelayed(col, row))
				.on("contextmenu", toggleFlagImmediately(col, row))
				.on("keydown", moveFocus(col, row))
				.effect((el) => {
					if (state.hasFocus?.[0] === col && state.hasFocus?.[1] === row) {
						el.focus();
					}
				});

			return DIV()
				.attr("role", "gridcell")
				.aria({
					colindex: col + 1,
				})
				.nodes(btn);
		}

		function updateTime() {
			state.time = Math.floor((Date.now() - startTime) / 1000);
		}

		function revealSquare(x, y) {
			return () => {
				let square = gameBoard.get(`${x} ${y}`);

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

					if (!square.isFlagged) {
						square.isRevealed = true;

						hiddenCount -= 1;

						if (square.isArmed) {
							state.playState = PLAY_STATES.LOST;

							clearInterval(timeInterval);

							for (let square of gameBoard.values()) {
								if (!(square.isFlagged && square.isArmed)) {
									square.isRevealed = true;
								}
							}
						} else {
							if (!square.isFlagged && square.armedAdjacentCount === 0) {
								let current = getAdjacent(x, y);

								do {
									let next = [];

									for (let square of current) {
										if (!square || square.isRevealed) {
											continue;
										}

										if (!square?.isArmed && !square?.isFlagged) {
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
									if (square.isArmed) {
										square.isFlagged = true;
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
		}

		function toggleFlagDelayed(x, y) {
			return (e) => {
				if (state.playState !== PLAY_STATES.PLAYING) {
					return;
				}

				let square = gameBoard.get(`${x} ${y}`);

				e.preventDefault();

				square.mouseDownStartTime = Date.now();

				square.mouseDownTimeout = setTimeout(() => {
					if (!square.isRevealed) {
						square.isFlagged = !square.isFlagged;

						state.flagCount += square.isFlagged ? -1 : 1;
					}
				}, 1_000);
			};
		}

		function toggleFlagImmediately(x, y) {
			return (e) => {
				if (state.playState !== PLAY_STATES.PLAYING) {
					return;
				}

				let square = gameBoard.get(`${x} ${y}`);

				e.preventDefault();

				if (!square.isRevealed) {
					square.isFlagged = !square.isFlagged;

					state.flagCount += square.isFlagged ? -1 : 1;
				}

				square.mouseDownStartTime = Infinity;

				clearTimeout(square.mouseDownTimeout);
			};
		}

		function moveFocus(x, y) {
			return (e) => {
				let keys = {
					ArrowUp: y > 0 ? [x, y - 1] : [],
					ArrowDown: y < height - 1 ? [x, y + 1] : [],
					ArrowLeft: x > 0 ? [x - 1, y] : y > 0 ? [width - 1, y - 1] : [],
					ArrowRight:
						x < width - 1 ? [x + 1, y] : y < height - 1 ? [0, y + 1] : [],
				};

				state.hasFocus = keys?.[e.key] ?? [];
			};
		}

		function getAdjacent(x, y) {
			let key = `${x} ${y}`;
			let result = adjacentMap.get(key);

			if (!result) {
				result = [
					`${x - 1} ${y - 1}`,
					`${x} ${y - 1}`,
					`${x + 1} ${y - 1}`,
					`${x - 1} ${y}`,
					`${x + 1} ${y}`,
					`${x - 1} ${y + 1}`,
					`${x} ${y + 1}`,
					`${x + 1} ${y + 1}`,
				].reduce((results, key) => {
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
