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
			"state.armedRunning": "任务运行中，完成后响铃提醒",
			"sound.label": "提示音",
			"sound.system": "系统音效",
			"sound.custom": "自定义文件…",
			"sound.customPlaceholder": "输入音频文件绝对路径",
			"sound.unavailable": "当前平台无内置音效，请输入文件路径",
			"volume.label": "音量"
		};
		const en = {
			"action.arm": "Notify me when finished",
			"action.disarm": "Turn off completion alert",
			"action.preview": "Preview sound",
			"aria.armed": "Completion alert on",
			"aria.unarmed": "Completion alert off",
			"state.armedRunning": "Running — will alert when finished",
			"sound.label": "Sound",
			"sound.system": "System sound",
			"sound.custom": "Custom file…",
			"sound.customPlaceholder": "Absolute audio file path",
			"sound.unavailable": "No built-in sounds on this platform — enter a file path",
			"volume.label": "Volume"
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
				}, signal),
				listSounds: (sessionId, signal) => call("listSounds", {
					sessionId,
					request: {}
				}, signal),
				getPrefs: (sessionId, signal) => call("getPrefs", {
					sessionId,
					request: {}
				}, signal),
				setPrefs: (sessionId, patch, signal) => call("setPrefs", {
					sessionId,
					request: patch
				}, signal)
			};
		}
		//#endregion
		//#region src/client/BellAction.tsx
		/**
		* The completion bell: one compact control in the composer's tool row, right
		* after the resident access-mode chrome (`conversation.input.left`). It
		* reads the armed state for the current session from the Host's
		* `sessionNotify` Remote service, toggles it on click, and its popover is a
		* small sound-settings panel (system sounds, a custom file path, volume, and
		* a preview).
		*
		* Preferences are read/written through the Host's `getPrefs`/`setPrefs`
		* Remotes rather than the browser settings transport, because dsh settings
		* RPCs only accept loopback clients — the bell must keep working when the GUI
		* is opened from a LAN IP (the Host writes into the same `session-notify`
		* settings namespace, so the Settings page and settings.yaml stay in sync).
		*/
		/** select value for the custom-file option. */
		const CUSTOM_KEY = "__custom__";
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
		/** Small caret opening the settings popover. */
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
		const panelStyle = {
			position: "absolute",
			bottom: "calc(100% + 6px)",
			left: 0,
			zIndex: 40,
			width: "248px",
			padding: "10px",
			borderRadius: "10px",
			background: "var(--dsh-color-bg-elevated, #ffffff)",
			border: "1px solid rgba(128, 128, 128, 0.25)",
			boxShadow: "0 6px 20px rgba(0, 0, 0, 0.14)",
			display: "flex",
			flexDirection: "column",
			gap: "8px"
		};
		const rowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "8px",
			fontSize: "12px"
		};
		const fieldStyle = {
			flex: 1,
			minWidth: 0,
			border: "1px solid rgba(128, 128, 128, 0.3)",
			borderRadius: "6px",
			background: "transparent",
			color: "inherit",
			padding: "4px 6px",
			fontSize: "12px"
		};
		const rangeStyle = {
			flex: 1,
			accentColor: "currentColor"
		};
		const previewButtonStyle = {
			border: "1px solid rgba(128, 128, 128, 0.3)",
			background: "transparent",
			borderRadius: "6px",
			padding: "4px 10px",
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
		* click to arm/disarm; the caret opens the sound-settings panel backed by the
		* Host's prefs Remotes (LAN-safe, unlike the browser settings transport).
		* @param props - framework slot currency, the namespace translator, and the injected Remote face.
		*/
		function BellAction({ sessionId, useSession, t, call }) {
			const [armed, setArmed] = (0, react.useState)(null);
			const [open, setOpen] = (0, react.useState)(false);
			const [names, setNames] = (0, react.useState)([]);
			const [prefs, setPrefs] = (0, react.useState)(null);
			/** Explicit "custom file" selection — drives the path input's visibility. */
			const [customMode, setCustomMode] = (0, react.useState)(false);
			/** In-progress custom path text (null = show the saved value). */
			const [customDraft, setCustomDraft] = (0, react.useState)(null);
			const [volDraft, setVolDraft] = (0, react.useState)(null);
			const rootRef = (0, react.useRef)(null);
			const running = useSession((snapshot) => snapshot.running);
			(0, react.useEffect)(() => {
				let cancelled = false;
				setArmed(null);
				call.getState(sessionId).then((outcome) => {
					if (!cancelled && outcome.ok) setArmed(outcome.value.armed);
				});
				return () => {
					cancelled = true;
				};
			}, [sessionId, call]);
			const prevRunning = (0, react.useRef)(running);
			(0, react.useEffect)(() => {
				const wasRunning = prevRunning.current;
				prevRunning.current = running;
				if (wasRunning && !running && armed === true) call.getState(sessionId).then((outcome) => {
					if (outcome.ok) setArmed(outcome.value.armed);
				});
			}, [
				running,
				armed,
				sessionId,
				call
			]);
			(0, react.useEffect)(() => {
				let cancelled = false;
				call.listSounds(sessionId).then((outcome) => {
					if (!cancelled && outcome.ok) setNames(outcome.value.names);
				});
				return () => {
					cancelled = true;
				};
			}, [sessionId, call]);
			(0, react.useEffect)(() => {
				setCustomMode(false);
				setCustomDraft(null);
				let cancelled = false;
				call.getPrefs(sessionId).then((outcome) => {
					if (!cancelled && outcome.ok) setPrefs(outcome.value);
				});
				return () => {
					cancelled = true;
				};
			}, [
				sessionId,
				call,
				open
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
			/** Write one prefs patch and adopt the echoed value. */
			const writePrefs = (patch) => {
				call.setPrefs(sessionId, patch).then((outcome) => {
					if (outcome.ok) setPrefs(outcome.value);
				});
			};
			const toggle = async () => {
				const next = !(armed ?? false);
				setArmed(next);
				const outcome = await call.setArmed(sessionId, next);
				if (outcome.ok) setArmed(outcome.value.armed);
			};
			const preview = async () => {
				await call.preview(sessionId);
			};
			const isArmed = armed === true;
			const isRunning = running && isArmed;
			const label = isArmed ? isRunning ? t("state.armedRunning") : t("action.disarm") : t("action.arm");
			const currentSound = prefs?.sound ?? "";
			const isCustom = customMode || currentSound !== "" && !names.includes(currentSound);
			const volume = volDraft ?? (prefs?.volume ?? 1) * 100;
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
					open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: panelStyle,
						role: "dialog",
						"aria-label": t("sound.label"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: rowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("sound.label") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									style: fieldStyle,
									value: isCustom ? CUSTOM_KEY : currentSound,
									onChange: (event) => {
										const picked = event.target.value;
										if (picked === CUSTOM_KEY) {
											setCustomMode(true);
											setCustomDraft("");
											return;
										}
										setCustomMode(false);
										setCustomDraft(null);
										writePrefs({ sound: picked });
									},
									"aria-label": t("sound.label"),
									children: [
										names.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: t("sound.unavailable")
										}) : null,
										names.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: name,
											children: name
										}, name)),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: CUSTOM_KEY,
											children: t("sound.custom")
										})
									]
								})]
							}),
							isCustom ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: rowStyle,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									style: fieldStyle,
									type: "text",
									value: customDraft ?? currentSound,
									placeholder: t("sound.customPlaceholder"),
									"aria-label": t("sound.customPlaceholder"),
									onChange: (event) => setCustomDraft(event.target.value),
									onBlur: (event) => {
										const path = event.target.value.trim();
										if (path !== "") writePrefs({ sound: path });
										setCustomDraft(null);
									},
									onKeyDown: (event) => {
										if (event.key === "Enter") {
											const path = event.target.value.trim();
											if (path !== "") writePrefs({ sound: path });
											setCustomDraft(null);
										}
									}
								})
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: rowStyle,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("volume.label") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										style: rangeStyle,
										type: "range",
										min: 0,
										max: 100,
										value: Math.round(volume),
										"aria-label": t("volume.label"),
										onChange: (event) => setVolDraft(Number(event.target.value)),
										onPointerUp: () => {
											if (volDraft !== null) writePrefs({ volume: volDraft / 100 });
											setVolDraft(null);
										},
										onKeyUp: () => {
											if (volDraft !== null) writePrefs({ volume: volDraft / 100 });
											setVolDraft(null);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: {
											width: "34px",
											textAlign: "right"
										},
										children: [Math.round(volume), "%"]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									...rowStyle,
									justifyContent: "center"
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: previewButtonStyle,
									onClick: () => void preview(),
									children: t("action.preview")
								})
							})
						]
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
			const call = notifyRpc();
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "session-notify",
				order: 10,
				locale: NS_NAME,
				inject: () => ({ call })
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