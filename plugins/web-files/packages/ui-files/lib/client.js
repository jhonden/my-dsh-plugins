window.__ModuleLoader__.load({
	id: "@gaowen/dsh-client-ui-files",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/FilesView.tsx
		/**
		* The Files view: a full-area workspace explorer occupying the conversation
		* center region. A file tree on the left (lazy-expanding, bounded listings)
		* and a read-only text viewer on the right. All data access flows through the
		* injected call face; session identity through the injected current-session
		* getter.
		*/
		/** Join a directory path and an entry name. */
		function joinPath(dir, name) {
			return dir === "" ? name : `${dir}/${name}`;
		}
		/** Map a typed error code to viewer copy, falling back to the generic line. */
		function errorKey(code) {
			if (code === "FILES_NOT_FOUND") return "viewer.error.notFound";
			if (code === "FILES_BINARY_REJECTED") return "viewer.error.binary";
			if (code === "FILES_PATH_OUTSIDE_WORKSPACE") return "viewer.error.outside";
			return "viewer.error.other";
		}
		/** A `.md` path (case-insensitive) renders through the preview by default. */
		function isMarkdown(path) {
			return path.toLowerCase().endsWith(".md");
		}
		/**
		* The view component. The inject face (`props`) is recreated by the slot
		* renderer on its own schedule, so no effect depends on `props` identity:
		* everything reaches the effects through a ref, and the effects key on real
		* state only. Remounting (tab switch away/back) reloads from scratch.
		*/
		function FilesView(props) {
			const face = (0, react.useRef)(props);
			face.current = props;
			const [rootListing, setRootListing] = (0, react.useState)(void 0);
			const [reading, setReading] = (0, react.useState)(void 0);
			/** Start-once sentinel: the loading state must not re-trigger the effect. */
			const rootStarted = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (rootStarted.current) return;
				rootStarted.current = true;
				const controller = new AbortController();
				(async () => {
					const sessionId = face.current.currentSessionId();
					if (sessionId === void 0) {
						setRootListing({
							state: "error",
							message: face.current.t("tree.error")
						});
						return;
					}
					setRootListing({ state: "loading" });
					const outcome = await face.current.call.list(sessionId, "", controller.signal);
					if (!outcome.ok) {
						setRootListing({
							state: "error",
							message: face.current.t("tree.error")
						});
						return;
					}
					setRootListing({
						state: "done",
						entries: outcome.value.entries,
						truncated: outcome.value.truncated
					});
				})();
				return () => controller.abort();
			}, []);
			const openFile = (0, react.useCallback)(async (path) => {
				const sessionId = face.current.currentSessionId();
				if (sessionId === void 0) return;
				setReading({
					state: "loading",
					path
				});
				const outcome = await face.current.call.read(sessionId, path);
				if (!outcome.ok) {
					setReading({
						state: "error",
						path,
						message: face.current.t(errorKey(outcome.error.code))
					});
					return;
				}
				setReading({
					state: "done",
					path,
					content: outcome.value.content,
					bytes: outcome.value.bytes,
					truncated: outcome.value.truncated
				});
			}, []);
			const listDir = (0, react.useCallback)(async (path, signal) => {
				const sessionId = face.current.currentSessionId();
				if (sessionId === void 0) return {
					state: "error",
					message: face.current.t("tree.error")
				};
				const outcome = await face.current.call.list(sessionId, path, signal);
				if (!outcome.ok) return {
					state: "error",
					message: face.current.t("tree.error")
				};
				return {
					state: "done",
					entries: outcome.value.entries,
					truncated: outcome.value.truncated
				};
			}, []);
			const t = props.t;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					width: "100%",
					flex: "1 1 0",
					minHeight: 0,
					overflow: "hidden",
					color: "var(--dsw-alias-label-primary, inherit)"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
					"aria-label": t("view.files"),
					style: {
						width: "280px",
						minWidth: "200px",
						flexShrink: 0,
						overflow: "auto",
						padding: "8px 4px",
						borderRight: "1px solid var(--dsw-alias-border-l2, #ccc)"
					},
					children: [
						rootListing?.state === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								opacity: .6,
								padding: "4px 8px"
							},
							children: t("tree.loading")
						}),
						rootListing?.state === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								padding: "4px 8px",
								color: "var(--dsw-alias-state-error-primary, #e55)"
							},
							children: rootListing.message
						}),
						rootListing?.state === "done" && rootListing.entries.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								opacity: .6,
								padding: "4px 8px"
							},
							children: t("tree.empty")
						}),
						rootListing?.state === "done" && rootListing.entries.map((child) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeRow, {
							entry: child,
							parentPath: "",
							depth: 0,
							t,
							listDir,
							onOpenFile: openFile
						}, child.name)),
						rootListing?.state === "done" && rootListing.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								opacity: .6,
								padding: "4px 8px"
							},
							children: t("tree.truncated")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ViewerColumn, {
					reading,
					t
				})]
			});
		}
		/** One tree row; directories expand lazily in place, files open in the viewer. */
		function TreeRow(props) {
			const { entry, parentPath, depth, t, listDir, onOpenFile } = props;
			const path = joinPath(parentPath, entry.name);
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [listing, setListing] = (0, react.useState)(void 0);
			/** Load-once sentinel per expansion: `listing` doubles as the data and must not re-trigger the effect. */
			const started = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (!expanded || started.current) return;
				started.current = true;
				const controller = new AbortController();
				setListing({ state: "loading" });
				listDir(path, controller.signal).then(setListing);
				return () => controller.abort();
			}, [
				expanded,
				path,
				listDir
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					style: {
						display: "block",
						width: "100%",
						textAlign: "left",
						padding: "3px 8px",
						background: "none",
						border: "none",
						color: "inherit",
						cursor: "pointer",
						fontSize: "13px",
						lineHeight: "20px",
						borderRadius: "4px",
						paddingLeft: `${depth * 14 + 8}px`
					},
					onMouseEnter: (event) => {
						event.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))";
					},
					onMouseLeave: (event) => {
						event.currentTarget.style.background = "none";
					},
					onClick: () => {
						if (entry.kind === "directory") setExpanded((e) => !e);
						else onOpenFile(path);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								display: "inline-block",
								width: "16px",
								opacity: .7
							},
							children: entry.kind === "directory" ? expanded ? "▾" : "▸" : ""
						}),
						entry.kind === "directory" ? "📁" : "📄",
						" ",
						entry.name
					]
				}),
				expanded && listing?.state === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						opacity: .6,
						padding: "2px 8px 2px 0",
						paddingLeft: `${(depth + 1) * 14 + 28}px`
					},
					children: t("tree.loading")
				}),
				expanded && listing?.state === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						padding: "2px 8px 2px 0",
						paddingLeft: `${(depth + 1) * 14 + 28}px`,
						color: "var(--dsw-alias-state-error-primary, #e55)"
					},
					children: listing.message
				}),
				expanded && listing?.state === "done" && listing.entries.map((child) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeRow, {
					entry: child,
					parentPath: path,
					depth: depth + 1,
					t,
					listDir,
					onOpenFile
				}, child.name)),
				expanded && listing?.state === "done" && listing.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						opacity: .6,
						paddingLeft: `${(depth + 1) * 14 + 28}px`
					},
					children: t("tree.truncated")
				})
			] });
		}
		/** The viewer column: empty, loading, error, or content (markdown preview for `.md`). */
		function ViewerColumn(props) {
			const { reading, t } = props;
			const [preview, setPreview] = (0, react.useState)(true);
			const openPath = reading?.state === "done" || reading?.state === "error" || reading?.state === "loading" ? reading.path : void 0;
			const shownPath = (0, react.useRef)(void 0);
			if (openPath !== shownPath.current) {
				shownPath.current = openPath;
				if (preview !== true) setPreview(true);
			}
			if (reading === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					flex: 1,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					opacity: .5
				},
				children: t("viewer.empty")
			});
			if (reading.state === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					flex: 1,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					opacity: .6
				},
				children: t("viewer.loading")
			});
			if (reading.state === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					flex: 1,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "var(--dsw-alias-state-error-primary, #e55)"
				},
				children: reading.message
			});
			const markdown = isMarkdown(reading.path);
			const showPreview = markdown && preview;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					flex: 1,
					display: "flex",
					flexDirection: "column",
					minHeight: 0
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						padding: "8px 16px",
						opacity: .65,
						display: "flex",
						gap: "12px",
						fontSize: "12px",
						borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.06))",
						alignItems: "center"
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: { fontWeight: 600 },
							children: reading.path
						}),
						reading.bytes != null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							reading.bytes,
							" ",
							t("viewer.bytes")
						] }),
						reading.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("viewer.truncated") }),
						markdown && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: {
								marginLeft: "auto",
								display: "inline-flex",
								border: "1px solid var(--dsw-alias-border-l2, #ccc)",
								borderRadius: "6px",
								overflow: "hidden"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": showPreview,
								onClick: () => {
									setPreview(true);
								},
								style: {
									padding: "2px 10px",
									border: "none",
									cursor: "pointer",
									fontSize: "12px",
									background: showPreview ? "var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.08))" : "transparent",
									color: "inherit"
								},
								children: t("viewer.preview")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": !showPreview,
								onClick: () => {
									setPreview(false);
								},
								style: {
									padding: "2px 10px",
									border: "none",
									borderLeft: "1px solid var(--dsw-alias-border-l2, #ccc)",
									cursor: "pointer",
									fontSize: "12px",
									background: !showPreview ? "var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.08))" : "transparent",
									color: "inherit"
								},
								children: t("viewer.source")
							})]
						})
					]
				}), showPreview ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						flex: 1,
						overflow: "auto",
						padding: "12px 20px"
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: reading.content })
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					style: {
						flex: 1,
						overflow: "auto",
						margin: 0,
						padding: "12px 16px",
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						fontSize: "13px",
						lineHeight: "20px",
						fontFamily: "var(--dsw-alias-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace)"
					},
					children: reading.content
				})]
			});
		}
		//#endregion
		//#region src/client/rpc.ts
		/** Random rpcId in the same UUID shape the shipped client uses. */
		function randomRpcId() {
			return crypto.randomUUID();
		}
		/**
		* Build the `filesRemote` caller bound to the browser origin.
		* @returns typed list/read functions returning carrier outcomes.
		*/
		function filesRpc() {
			async function call(method, args, signal) {
				const rpcId = randomRpcId();
				try {
					const response = await fetch(new URL(`/api/filesRemote/${method}`, globalThis.location.origin), {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							type: "client-request",
							rpcId,
							method: `filesRemote/${method}`,
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
				list: (sessionId, path, signal) => call("list", {
					sessionId,
					request: { path }
				}, signal),
				read: (sessionId, path, signal) => call("read", {
					sessionId,
					request: { path }
				}, signal)
			};
		}
		//#endregion
		//#region src/client/locales.ts
		/** Browser copy for the files explorer, zh and en dictionaries. */
		const zh = {
			"view.files": "文件",
			"tree.empty": "此目录为空",
			"tree.error": "加载失败",
			"tree.truncated": "条目过多，仅显示开头部分",
			"tree.loading": "加载中…",
			"viewer.loading": "加载中…",
			"viewer.empty": "选择一个文件查看内容",
			"viewer.truncated": "文件过大，仅显示开头部分",
			"viewer.preview": "预览",
			"viewer.source": "源码",
			"viewer.error.notFound": "文件不存在",
			"viewer.error.binary": "二进制文件不支持预览",
			"viewer.error.outside": "路径超出工作区范围",
			"viewer.error.other": "读取失败",
			"viewer.bytes": "字节"
		};
		const en = {
			"view.files": "Files",
			"tree.empty": "This directory is empty",
			"tree.error": "Failed to load",
			"tree.truncated": "Too many entries; only the beginning is shown",
			"tree.loading": "Loading…",
			"viewer.loading": "Loading…",
			"viewer.empty": "Select a file to view its content",
			"viewer.truncated": "File too large; only the beginning is shown",
			"viewer.preview": "Preview",
			"viewer.source": "Source",
			"viewer.error.notFound": "File not found",
			"viewer.error.binary": "Binary files are not previewable",
			"viewer.error.outside": "Path is outside the workspace",
			"viewer.error.other": "Read failed",
			"viewer.bytes": "bytes"
		};
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace owning the explorer's copy. */
		const NS = "web-files";
		/** Required services: the slot registry, the sessions store, and locale. */
		const inject = [
			"slots",
			"sessions",
			"locale"
		];
		/**
		* Client plugin body: register the dictionaries and the Files view tab.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				const disposers = [ctx.locale.register(NS, "zh", zh), ctx.locale.register(NS, "en", en)];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-files: dictionaries");
			const t = ctx.locale.bind(NS);
			const call = filesRpc();
			/** Current session id from the sessions list snapshot (`SessionListState.current`). */
			const currentSessionId = () => ctx.sessions.list.getSnapshot().current;
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "files",
				order: 20,
				locale: NS,
				label: () => t("view.files"),
				inject: () => ({
					call,
					currentSessionId
				})
			}, FilesView));
		}
		//#endregion
		exports.FilesView = FilesView;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map