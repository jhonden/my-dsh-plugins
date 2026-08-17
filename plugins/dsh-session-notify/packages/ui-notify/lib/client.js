window.__ModuleLoader__.load({
	id: "@gaowen/dsh-client-ui-notify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/** Browser copy for the completion bell, zh and en dictionaries. */
		const zh = {
			"action.arm": "完成时提醒我",
			"action.disarm": "取消完成提醒",
			"action.preview": "试听提示音",
			"aria.armed": "完成提醒已开启",
			"aria.unarmed": "完成提醒已关闭",
			"state.armedRunning": "任务运行中，完成后响铃提醒"
		};
		const en = {
			"action.arm": "Notify me when finished",
			"action.disarm": "Turn off completion alert",
			"action.preview": "Preview sound",
			"aria.armed": "Completion alert on",
			"aria.unarmed": "Completion alert off",
			"state.armedRunning": "Running — will alert when finished"
		};
		/** Locale namespace owning the bell's copy. */
		const NS = "dsh-notify";
		//#endregion
		//#region src/client/rpc.ts
		/** Random rpcId in the same UUID shape the shipped client uses. */
		function randomRpcId() {
			return crypto.randomUUID();
		}
		/**
		* Build the `sessionNotify` caller bound to the browser origin.
		* @returns typed getState/setArmed/preview functions returning carrier outcomes.
		*/
		function notifyRpc() {
			async function call(method, args, signal) {
				const rpcId = randomRpcId();
				try {
					const response = await fetch(new URL(`/api/sessionNotify/${method}`, globalThis.location.origin), {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							type: "client-request",
							rpcId,
							method: `sessionNotify/${method}`,
							payload: { args }
						}),
						...signal === void 0 ? {} : { signal }
					});
					if (!response.ok) return {
						ok: false,
						error: {
							code: "transport",
							message: `HTTP ${response.status}`
						}
					};
					const full = await response.json();
					if (full.rpcId !== rpcId) return {
						ok: false,
						error: {
							code: "rpc-id-mismatch",
							message: "carrier returned a mismatched rpcId"
						}
					};
					if (!full.result.ok) return {
						ok: false,
						error: {
							code: full.result.error?.code ?? "unknown",
							message: full.result.error?.message ?? "unknown error"
						}
					};
					return {
						ok: true,
						value: full.result.value
					};
				} catch (error) {
					return {
						ok: false,
						error: {
							code: "transport",
							message: error instanceof Error ? error.message : String(error)
						}
					};
				}
			}
			return {
				getState: (sessionId, signal) => call("getState", {
					sessionId,
					request: {}
				}, signal),
				setArmed: (sessionId, armed, signal) => call("setArmed", {
					sessionId,
					request: { armed }
				}, signal),
				preview: (sessionId, signal) => call("preview", {
					sessionId,
					request: {}
				}, signal)
			};
		}
		//#endregion
		//#region src/client/BellAction.tsx
		/**
		* The completion bell: one compact control in the composer's tool row, right
		* after the resident access-mode chrome (`conversation.input.left`). It
		* reads the armed state for the current session from the Host's
		* `sessionNotify` Remote service, toggles it on click, offers a sound
		* preview in a tiny popover, and re-syncs after a run completes (the Host
		* auto-disarms in one-shot mode, so the bell must refetch to un-light).
		*/
		/** Bell outline (unarmed). */
		function BellOutline() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" })]
			});
		}
		/** Filled bell (armed). */
		function BellFilled() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 24 24",
				fill: "currentColor",
				stroke: "currentColor",
				strokeWidth: "1.4",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" })]
			});
		}
		/** Small caret opening the preview popover. */
		function Caret() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "10",
				height: "10",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m6 9 6 6 6-6" })
			});
		}
		/** Shared button look inside the composer tool row (compact, one row tall). */
		const buttonStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: "22px",
			height: "22px",
			border: "none",
			background: "transparent",
			borderRadius: "6px",
			cursor: "pointer",
			color: "inherit",
			padding: 0
		};
		const groupStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: "1px",
			position: "relative",
			borderRadius: "6px"
		};
		const menuStyle = {
			position: "absolute",
			top: "calc(100% + 4px)",
			right: 0,
			zIndex: 30,
			minWidth: "128px",
			padding: "4px",
			borderRadius: "8px",
			background: "var(--dsh-color-bg-elevated, #ffffff)",
			border: "1px solid rgba(128, 128, 128, 0.25)",
			boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
			listStyle: "none",
			margin: 0
		};
		const menuItemStyle = {
			display: "flex",
			alignItems: "center",
			gap: "6px",
			width: "100%",
			border: "none",
			background: "transparent",
			borderRadius: "4px",
			padding: "6px 8px",
			fontSize: "12px",
			cursor: "pointer",
			color: "inherit"
		};
		const dotStyle = {
			position: "absolute",
			top: "1px",
			right: "4px",
			width: "6px",
			height: "6px",
			borderRadius: "50%",
			background: "#f59e0b"
		};
		/**
		* The completion bell for one session, sitting beside the access-mode chrome:
		* click to arm/disarm, a caret opens the sound preview, and the run's
		* `running` flag drives a status dot plus the one-shot re-sync performed by
		* the Host.
		* @param props - framework slot currency plus the namespace translator.
		*/
		function BellAction({ sessionId, useSession, t }) {
			const [armed, setArmed] = (0, react.useState)(null);
			const [open, setOpen] = (0, react.useState)(false);
			const rpc = (0, react.useMemo)(() => notifyRpc(), []);
			const running = useSession((snapshot) => snapshot.running);
			const rootRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				let cancelled = false;
				setArmed(null);
				rpc.getState(sessionId).then((outcome) => {
					if (!cancelled && outcome.ok) setArmed(outcome.value.armed);
				});
				return () => {
					cancelled = true;
				};
			}, [sessionId, rpc]);
			const prevRunning = (0, react.useRef)(running);
			(0, react.useEffect)(() => {
				const wasRunning = prevRunning.current;
				prevRunning.current = running;
				if (wasRunning && !running && armed === true) rpc.getState(sessionId).then((outcome) => {
					if (outcome.ok) setArmed(outcome.value.armed);
				});
			}, [
				running,
				armed,
				sessionId,
				rpc
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const closeOutside = (event) => {
					if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
				};
				document.addEventListener("pointerdown", closeOutside);
				return () => {
					document.removeEventListener("pointerdown", closeOutside);
				};
			}, [open]);
			const toggle = async () => {
				const next = !(armed ?? false);
				setArmed(next);
				const outcome = await rpc.setArmed(sessionId, next);
				if (outcome.ok) setArmed(outcome.value.armed);
			};
			const preview = async () => {
				setOpen(false);
				await rpc.preview(sessionId);
			};
			const isArmed = armed === true;
			const isRunning = running && isArmed;
			const label = isArmed ? isRunning ? t("state.armedRunning") : t("action.disarm") : t("action.arm");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				style: groupStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: buttonStyle,
						"aria-label": label,
						"aria-pressed": isArmed,
						title: label,
						onClick: () => void toggle(),
						children: isArmed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BellFilled, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BellOutline, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: {
							...buttonStyle,
							width: "14px"
						},
						"aria-label": t("action.preview"),
						"aria-expanded": open,
						title: t("action.preview"),
						onClick: (event) => {
							event.stopPropagation();
							setOpen((current) => !current);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Caret, {})
					}),
					isRunning ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: dotStyle,
						"aria-hidden": "true"
					}) : null,
					open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						style: menuStyle,
						role: "menu",
						"aria-label": t("action.preview"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
							role: "none",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "menuitem",
								style: menuItemStyle,
								onClick: () => void preview(),
								children: t("action.preview")
							})
						})
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace owning the bell's copy. */
		const NS_NAME = NS;
		/** Required services: the slot registry and locale. */
		const inject = ["slots", "locale"];
		/**
		* Client plugin body: register the dictionaries and the composer bell.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				const disposers = [ctx.locale.register(NS_NAME, "zh", zh), ctx.locale.register(NS_NAME, "en", en)];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-notify: dictionaries");
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "session-notify",
				order: 10,
				locale: NS_NAME
			}, BellAction));
		}
		//#endregion
		exports.BellAction = BellAction;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map