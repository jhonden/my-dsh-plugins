window.__ModuleLoader__.load({
	id: "@gaowen/dsh-client-ui-files",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../files-remote/lib/images.js
		/**
		* Image extension allowlist and media types for the preview route. The
		* allowlist is the security boundary: only these extensions are ever served,
		* each with its exact Content-Type, so a served response can never be
		* interpreted as HTML (no sniffing ambiguity) or leak a non-image file.
		*/
		/** Extension (lowercase, no dot) → exact response Content-Type. */
		const IMAGE_MEDIA_TYPES = {
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			webp: "image/webp",
			bmp: "image/bmp",
			ico: "image/x-icon",
			svg: "image/svg+xml"
		};
		/**
		* Media type for a path's extension, or `undefined` for non-image paths.
		* @param path - session-workspace-relative file path.
		*/
		function imageMediaTypeFor(path) {
			const base = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
			const dot = base.lastIndexOf(".");
			if (dot <= 0) return void 0;
			return IMAGE_MEDIA_TYPES[base.slice(dot + 1).toLowerCase()];
		}
		//#endregion
		//#region src/client/lang.ts
		/**
		* File-extension → language-id mapping for the viewer's syntax highlighting.
		* Vendored from dsh-tool-fs's read-render.ts (upstream ships no `src/` in the
		* npm tarball, so the map cannot be imported from the published package); the
		* short-form ids align with ui-primitives' `LANG_ALIASES`, which resolves them
		* to shiki grammars. Keep in sync with upstream when it grows.
		*/
		const LANG_BY_EXTENSION = {
			ts: "ts",
			tsx: "tsx",
			mts: "ts",
			cts: "ts",
			js: "js",
			jsx: "jsx",
			mjs: "js",
			cjs: "js",
			json: "json",
			jsonc: "json",
			py: "py",
			rb: "rb",
			go: "go",
			rs: "rs",
			java: "java",
			c: "c",
			h: "c",
			cc: "cpp",
			cpp: "cpp",
			hpp: "cpp",
			cxx: "cpp",
			cs: "cs",
			kt: "kotlin",
			swift: "swift",
			php: "php",
			sh: "sh",
			bash: "sh",
			zsh: "sh",
			yaml: "yaml",
			yml: "yaml",
			toml: "toml",
			ini: "ini",
			md: "md",
			markdown: "md",
			mdx: "mdx",
			html: "html",
			htm: "html",
			css: "css",
			scss: "scss",
			less: "less",
			sql: "sql",
			xml: "xml",
			lua: "lua"
		};
		/**
		* Derive a highlighting language hint from a file path's extension.
		* Pure, case-insensitive on the extension; a dotfile (`.gitignore`) and an
		* unknown extension both yield `undefined`.
		* @param path - session-workspace-relative file path.
		* @returns the short-form language id, or `undefined` when none maps.
		*/
		function langFromPath(path) {
			const base = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
			const dot = base.lastIndexOf(".");
			if (dot <= 0) return void 0;
			const ext = base.slice(dot + 1).toLowerCase();
			return Object.hasOwn(LANG_BY_EXTENSION, ext) ? LANG_BY_EXTENSION[ext] : void 0;
		}
		//#endregion
		//#region src/client/filter.ts
		/** Match range of a name against a lowercase query, or undefined. */
		function matchRange(name, query) {
			const index = name.toLowerCase().indexOf(query);
			return index === -1 ? void 0 : [index, index + query.length];
		}
		/**
		* Keep one entry when its name matches, or (for directories) any loaded
		* descendant matches. Synchronous recursion over already-loaded state.
		* @param entry - the row candidate.
		* @param path - its workspace-relative path.
		* @param query - lowercase filter text; empty keeps everything.
		* @param childrenOf - loaded-children accessor for directories.
		* @returns the kept row, or undefined to prune.
		*/
		function keep(entry, path, query, childrenOf) {
			const match = matchRange(entry.name, query);
			if (entry.kind === "file") return match === void 0 ? void 0 : {
				entry,
				match
			};
			if (match !== void 0) return {
				entry,
				match
			};
			const children = childrenOf(path) ?? [];
			for (const child of children) if (keep(child, joinPath$1(path, child.name), query, childrenOf) !== void 0) return {
				entry,
				match: void 0
			};
		}
		/** Join a directory path and an entry name. */
		function joinPath$1(dir, name) {
			return dir === "" ? name : `${dir}/${name}`;
		}
		/**
		* Filter one loaded directory level against the whole loaded subtree.
		* @param entries - one directory's loaded children.
		* @param dirPath - that directory's workspace-relative path (`''` = root).
		* @param query - lowercase filter text; empty returns everything unmatched-free.
		* @param childrenOf - loaded-children accessor for descendant walks.
		* @returns kept entries with match ranges for highlighting.
		*/
		function filterLevel(entries, dirPath, query, childrenOf) {
			if (query === "") return entries.map((entry) => ({
				entry,
				match: void 0
			}));
			const kept = [];
			for (const entry of entries) {
				const row = keep(entry, joinPath$1(dirPath, entry.name), query, childrenOf);
				if (row !== void 0) kept.push(row);
			}
			return kept;
		}
		/**
		* The empty-query test after trimming; whitespace-only input filters nothing.
		* @param raw - the filter box's current value.
		*/
		function activeQuery(raw) {
			return raw.trim().toLowerCase();
		}
		//#endregion
		//#region src/client/path-row.ts
		/** Split a path into directory (with trailing separator) and file name. */
		function splitPath(path) {
			const slash = path.lastIndexOf("/");
			if (slash === -1) return {
				dir: "",
				name: path
			};
			return {
				dir: path.slice(0, slash + 1),
				name: path.slice(slash + 1)
			};
		}
		/**
		* Compress a directory segment to at most `maxChars` characters with a middle
		* ellipsis, keeping the tail (the deepest directories, most discriminative).
		* Keeps whole path segments: it cuts at a `/` boundary near the middle.
		* @param dir - directory portion including the trailing `/`.
		* @param maxChars - inclusive cap on the rendered length.
		* @returns the compressed directory, ending with `/`; `…/` when nothing fits.
		*/
		function compressDir(dir, maxChars) {
			if (dir.length <= maxChars) return dir;
			const budget = Math.max(maxChars - 1, 2);
			const segments = [];
			let used = 0;
			let end = dir.length;
			while (end > 0) {
				const slash = dir.lastIndexOf("/", end - 1);
				const segment = dir.slice(slash + 1, end) + (dir[end] === "/" ? "" : "/");
				const cost = segment.length;
				if (used + cost > budget && segments.length > 0) break;
				if (used + cost > budget) break;
				segments.unshift(segment);
				used += cost;
				end = slash;
				if (end === dir.length - 1 && dir[end] === "/") end = slash;
			}
			if (segments.length === 0) return "…/";
			return `…${segments.join("")}`;
		}
		//#endregion
		//#region src/client/md-images.ts
		/**
		* Rewrite relative image references in markdown to the Host preview route.
		*
		* `MarkdownText` (the platform renderer) only permits absolute http(s) image
		* URLs — correct for untrusted assistant output, wrong for a file viewer
		* showing the user's own README. Rewriting `![alt](rel.png)` destinations to
		* the preview-route URL (absolute http(s) with query params) lets the same
		* renderer display workspace images without weakening its safety rules:
		* paths stay workspace-confined on the Host and cross-site embeds are denied
		* by the route's same-origin fence.
		*/
		/** The Host preview route prefix registered by files-remote. */
		const PREVIEW_ROUTE$1 = "/plugins-web-files/preview";
		/**
		* Scan markdown source for inline image destinations, skipping code spans
		* (`…`) and fenced code blocks (```…```) — example syntax inside code is
		* literal text and must not be rewritten. Handles balanced parens inside the
		* destination and escaped parens; returns refs in source order.
		*/
		function scanInlineImages(source) {
			const refs = [];
			let i = 0;
			while (i < source.length - 1) {
				const ch = source[i];
				if ((ch === "`" || ch === "~") && source[i + 1] === ch && source[i + 2] === ch) {
					const fence = ch.repeat(3);
					const close = source.indexOf(fence, i + 3);
					i = close === -1 ? source.length : close + 3;
					continue;
				}
				if (ch === "`") {
					let run = 1;
					while (source[i + run] === "`") run++;
					const closer = "`".repeat(run);
					const close = source.indexOf(closer, i + run);
					i = close === -1 ? source.length : close + run;
					continue;
				}
				if (ch !== "!" || source[i + 1] !== "[") {
					i++;
					continue;
				}
				const close = source.indexOf("]", i + 2);
				if (close === -1 || close + 1 >= source.length || source[close + 1] !== "(") {
					i++;
					continue;
				}
				let depth = 1;
				let j = close + 2;
				while (j < source.length && depth > 0) {
					const c = source[j];
					if (c === "\\") {
						j += 2;
						continue;
					}
					if (c === "(") depth++;
					else if (c === ")") depth--;
					if (depth === 0) break;
					j++;
				}
				if (depth !== 0) {
					i = close;
					continue;
				}
				refs.push({
					start: close + 1,
					end: j + 1,
					destination: source.slice(close + 2, j)
				});
				i = j;
			}
			return refs;
		}
		/** Test one destination: image extension, relative (no scheme, no //). */
		function isRelativeImage(destination) {
			const trimmed = destination.trim();
			if (trimmed === "" || trimmed.startsWith("<")) return false;
			if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return false;
			const clean = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
			const dot = clean.lastIndexOf(".");
			if (dot <= 0) return false;
			const ext = clean.slice(dot + 1).toLowerCase();
			return Object.hasOwn(IMAGE_MEDIA_TYPES, ext);
		}
		/** URL-encode one path segment, keeping `/` separators. */
		function encodePath(path) {
			return path.split("/").map(encodeURIComponent).join("/");
		}
		/**
		* Rewrite relative image destinations to the preview route as absolute URLs —
		* the platform renderer permits only absolute http(s) image destinations, so
		* a scheme-relative path would still render as alt text.
		* @param source - the markdown text.
		* @param sessionId - the session whose workspace confines the images.
		* @param baseDir - directory of the markdown file (`''` = workspace root);
		*   relative destinations resolve against it.
		* @returns markdown with image destinations pointing at the preview route.
		*/
		function rewriteMarkdownImages(source, sessionId, baseDir) {
			const refs = scanInlineImages(source);
			if (refs.length === 0) return source;
			const origin = globalThis.location?.origin;
			if (origin === void 0) return source;
			let out = "";
			let cursor = 0;
			for (const ref of refs) {
				if (!isRelativeImage(ref.destination)) continue;
				const raw = ref.destination.trim();
				const pathPart = raw.split(/[?#]/, 1)[0] ?? raw;
				const suffix = raw.slice(pathPart.length);
				const joined = baseDir === "" ? pathPart : `${baseDir}/${pathPart}`;
				const url = `${origin}${PREVIEW_ROUTE$1}?sessionId=${encodeURIComponent(sessionId)}&path=${encodePath(joined)}${suffix}`;
				out += source.slice(cursor, ref.start) + `(${url})`;
				cursor = ref.end;
			}
			return out + source.slice(cursor);
		}
		//#endregion
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
		/** The preview route images render from; matches files-remote's Host route. */
		const PREVIEW_ROUTE = "/plugins-web-files/preview";
		/** An image-extension path renders through the preview route, not text read. */
		function isImagePath(path) {
			return imageMediaTypeFor(path) !== void 0;
		}
		/** Absolute preview-route URL for one workspace image. */
		function previewUrl(sessionId, path) {
			return `${globalThis.location?.origin ?? ""}${PREVIEW_ROUTE}?sessionId=${encodeURIComponent(sessionId)}&path=${path.split("/").map(encodeURIComponent).join("/")}`;
		}
		/** A `.md` path (case-insensitive) renders through the preview by default. */
		function isMarkdown(path) {
			return path.toLowerCase().endsWith(".md");
		}
		/** Height cap before ReadBlock collapses the middle; a viewer shows far more than a chat card. */
		const VIEWER_MAX_LINES = 2e3;
		/** Split whole-file content into 1-based numbered lines, dropping the trailing empty line. */
		function toLines(content) {
			const split = content.split("\n");
			return (split[split.length - 1] === "" ? split.slice(0, -1) : split).map((text, index) => ({
				number: index + 1,
				text
			}));
		}
		/** Directory portion of a session-relative path (`''` for a root file). */
		function dirOf(path) {
			const slash = path.lastIndexOf("/");
			return slash === -1 ? "" : path.slice(0, slash);
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
				if (isImagePath(path)) {
					setReading({
						state: "image",
						path,
						url: previewUrl(sessionId, path)
					});
					return;
				}
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
			const [filterRaw, setFilterRaw] = (0, react.useState)("");
			const query = activeQuery(filterRaw);
			const filtering = query !== "";
			/** Loaded directory listings by path — TreeRows report in as they load. */
			const loadedRef = (0, react.useRef)(/* @__PURE__ */ new Map());
			const [, bumpLoaded] = (0, react.useState)(0);
			const childrenOf = (0, react.useCallback)((dir) => loadedRef.current.get(dir), []);
			/**
			* Recursive search: debounced `filesRemote/search` (rg over the whole
			* workspace), generation-fenced so a stale response never lands. The
			* result replaces the tree with a flat path list until the query clears.
			*/
			const [searchState, setSearchState] = (0, react.useState)({ phase: "idle" });
			const searchGen = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				if (query === "") {
					searchGen.current++;
					setSearchState({ phase: "idle" });
					return;
				}
				const gen = ++searchGen.current;
				setSearchState({
					phase: "searching",
					query
				});
				const controller = new AbortController();
				const timer = setTimeout(() => {
					(async () => {
						const sessionId = face.current.currentSessionId();
						if (sessionId === void 0) return;
						const outcome = await face.current.call.search(sessionId, filterRaw, controller.signal);
						if (gen !== searchGen.current) return;
						const aborted = !outcome.ok && (controller.signal.aborted || outcome.error.code === "transport" && outcome.error.message.toLowerCase().includes("abort"));
						if (!outcome.ok) {
							if (!aborted) setSearchState({
								phase: "error",
								query
							});
							return;
						}
						setSearchState({
							phase: "done",
							query,
							paths: outcome.value.paths,
							truncated: outcome.value.truncated
						});
					})();
				}, 250);
				return () => {
					clearTimeout(timer);
					controller.abort();
				};
			}, [query, filterRaw]);
			const reportLoaded = (0, react.useCallback)((path, entries) => {
				const map = loadedRef.current;
				const had = map.has(path);
				if (entries === null) {
					if (!had) return;
					map.delete(path);
				} else {
					if (had && map.get(path) === entries) return;
					map.set(path, entries);
				}
				bumpLoaded((n) => n + 1);
			}, []);
			/** Root filter with whole-loaded-subtree pruning (only live paths stay). */
			const rootFiltered = rootListing?.state === "done" ? filterLevel(rootListing.entries, "", query, childrenOf) : [];
			const rootEmpty = rootListing?.state === "done" && (filtering ? rootFiltered.length === 0 : rootListing.entries.length === 0);
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
						borderRight: "1px solid var(--dsw-alias-border-l2, #ccc)",
						display: "flex",
						flexDirection: "column"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FilterBox, {
						value: filterRaw,
						onChange: setFilterRaw,
						placeholder: t("filter.placeholder"),
						clearLabel: t("filter.clear"),
						t,
						searching: searchState.phase === "searching"
					}), searchState.phase === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchResults, {
						state: searchState,
						query,
						t,
						onOpen: openFile
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							flex: 1,
							overflow: "auto",
							padding: "4px 4px"
						},
						children: [
							searchState.phase === "searching" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									opacity: .6,
									padding: "4px 8px"
								},
								children: t("search.searching")
							}),
							searchState.phase === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									padding: "4px 8px",
									color: "var(--dsw-alias-state-error-primary, #e55)"
								},
								children: t("search.error")
							}),
							rootListing?.state === "loading" && !filtering && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									opacity: .6,
									padding: "4px 8px"
								},
								children: t("tree.loading")
							}),
							rootListing?.state === "error" && !filtering && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									padding: "4px 8px",
									color: "var(--dsw-alias-state-error-primary, #e55)"
								},
								children: rootListing.message
							}),
							rootEmpty && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									opacity: .6,
									padding: "4px 8px"
								},
								children: filtering ? t("filter.noMatch") : t("tree.empty")
							}),
							rootFiltered.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeRow, {
								entry: row.entry,
								match: row.match,
								parentPath: "",
								depth: 0,
								t,
								listDir,
								onOpenFile: openFile,
								filtering,
								query,
								childrenOf,
								reportLoaded
							}, row.entry.name)),
							rootListing?.state === "done" && rootListing.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									opacity: .6,
									padding: "4px 8px"
								},
								children: t("tree.truncated")
							})
						]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ViewerColumn, {
					reading,
					t,
					sessionId: face.current.currentSessionId()
				})]
			});
		}
		/** The filter box: icon, focus ring, inline clear button, subtle scope hint. */
		function FilterBox(props) {
			const { value, onChange, placeholder, clearLabel, t, searching } = props;
			const [focused, setFocused] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: "8px 8px 4px",
					borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.04))"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: "6px",
						padding: "0 8px",
						borderRadius: "8px",
						border: `1px solid ${focused ? "var(--dsw-alias-state-business-primary, #4c6ef5)" : "var(--dsw-alias-border-l2, rgba(0,0,0,0.1))"}`,
						background: "var(--dsw-alias-bg-base, transparent)",
						boxShadow: focused ? "0 0 0 2px var(--dsw-alias-interactive-bg-hover-accent, rgba(38,49,72,0.14))" : "none",
						transition: "border-color .12s, box-shadow .12s"
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": true,
							style: {
								opacity: .5,
								fontSize: "13px",
								flexShrink: 0
							},
							children: searching ? "⏳" : "🔍"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "text",
							value,
							placeholder,
							"aria-label": placeholder,
							onChange: (event) => {
								onChange(event.target.value);
							},
							onFocus: () => {
								setFocused(true);
							},
							onBlur: () => {
								setFocused(false);
							},
							style: {
								flex: 1,
								minWidth: 0,
								padding: "5px 0",
								fontSize: "12px",
								border: "none",
								background: "transparent",
								color: "inherit",
								outline: "none"
							}
						}),
						value !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": clearLabel,
							title: clearLabel,
							onClick: () => {
								onChange("");
							},
							style: {
								border: "none",
								background: "var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))",
								color: "inherit",
								cursor: "pointer",
								padding: "0",
								width: "16px",
								height: "16px",
								borderRadius: "50%",
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: "10px",
								lineHeight: 1,
								flexShrink: 0
							},
							children: "✕"
						})
					]
				}), value.trim() !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						opacity: .5,
						fontSize: "11px",
						padding: "4px 2px 0"
					},
					children: t("filter.loadedOnly")
				})]
			});
		}
		/** Flat recursive-search results: dim compressed dir + full file name, click to open. */
		function SearchResults(props) {
			const { state, query, t, onOpen } = props;
			if (state.paths.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					flex: 1,
					overflow: "auto",
					padding: "8px 10px",
					opacity: .6
				},
				children: t("search.noMatch")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					flex: 1,
					overflow: "auto",
					padding: "4px 4px"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						opacity: .55,
						fontSize: "11px",
						padding: "2px 6px 6px"
					},
					children: [t("search.count").replace("{n}", String(state.paths.length)), state.truncated ? ` · ${t("search.truncated")}` : ""]
				}), state.paths.map((path) => {
					const { dir, name } = splitPath(path);
					const shownDir = compressDir(dir, Math.max(18, 44 - name.length));
					const nameIndex = name.toLowerCase().indexOf(query);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						title: path,
						onClick: () => {
							onOpen(path);
						},
						style: {
							display: "block",
							width: "100%",
							textAlign: "left",
							padding: "3px 8px",
							background: "none",
							border: "none",
							color: "inherit",
							cursor: "pointer",
							fontSize: "12px",
							lineHeight: "18px",
							borderRadius: "4px",
							fontFamily: "var(--dsw-alias-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace)",
							wordBreak: "break-all"
						},
						onMouseEnter: (event) => {
							event.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))";
						},
						onMouseLeave: (event) => {
							event.currentTarget.style.background = "none";
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								opacity: .55,
								fontSize: 11
							},
							children: shownDir
						}), nameIndex === -1 ? name : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							name.slice(0, nameIndex),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("mark", {
								style: {
									background: "var(--dsw-alias-interactive-bg-hover-accent, rgba(38,49,72,0.14))",
									color: "inherit",
									borderRadius: "2px",
									padding: "0 1px"
								},
								children: name.slice(nameIndex, nameIndex + query.length)
							}),
							name.slice(nameIndex + query.length)
						] })]
					}, path);
				})]
			});
		}
		/** One tree row; directories expand lazily in place, files open in the viewer. */
		function TreeRow(props) {
			const { entry, match, parentPath, depth, t, filtering, query, childrenOf, reportLoaded, listDir, onOpenFile } = props;
			const path = joinPath(parentPath, entry.name);
			const isDir = entry.kind === "directory";
			const [userExpanded, setUserExpanded] = (0, react.useState)(false);
			const [listing, setListing] = (0, react.useState)(void 0);
			/** Filter mode force-expands loaded DIRECTORIES so matches stay reachable;
			*  a file row never expands and never lists — its path is not a directory. */
			const expanded = isDir && (filtering || userExpanded);
			/** Load-once sentinel per expansion: `listing` doubles as the data and must not re-trigger the effect. */
			const started = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (!isDir || !expanded || started.current) return;
				started.current = true;
				const controller = new AbortController();
				setListing({ state: "loading" });
				let disposed = false;
				listDir(path, controller.signal).then((result) => {
					if (disposed || controller.signal.aborted) return;
					setListing(result);
					reportLoaded(path, result.state === "done" ? result.entries : null);
				});
				return () => {
					disposed = true;
					controller.abort();
				};
			}, [
				isDir,
				expanded,
				path,
				listDir,
				reportLoaded
			]);
			/** Children: during filtering, whole-loaded-subtree pruning like the root. */
			const childRows = listing?.state === "done" ? query === "" ? listing.entries.map((entry) => ({
				entry,
				match: void 0
			})) : filterLevel(listing.entries, path, query, childrenOf) : [];
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
						if (entry.kind === "directory") setUserExpanded((e) => !e);
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
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HighlightedName, {
							name: entry.name,
							match
						})
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
				expanded && childRows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeRow, {
					entry: row.entry,
					match: row.match,
					parentPath: path,
					depth: depth + 1,
					t,
					listDir,
					onOpenFile,
					filtering,
					query,
					childrenOf,
					reportLoaded
				}, row.entry.name)),
				expanded && listing?.state === "done" && listing.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						opacity: .6,
						paddingLeft: `${(depth + 1) * 14 + 28}px`
					},
					children: t("tree.truncated")
				})
			] });
		}
		/** Name text with the matched range marked. */
		function HighlightedName(props) {
			const { name, match } = props;
			if (match === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: name });
			const [start, end] = match;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				name.slice(0, start),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("mark", {
					style: {
						background: "var(--dsw-alias-interactive-bg-hover-accent, rgba(38,49,72,0.14))",
						color: "inherit",
						borderRadius: "2px",
						padding: "0 1px"
					},
					children: name.slice(start, end)
				}),
				name.slice(end)
			] });
		}
		/** The viewer column: empty, loading, error, or content (markdown preview for `.md`). */
		function ViewerColumn(props) {
			const { reading, t } = props;
			const sessionId = props.sessionId;
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
			if (reading.state === "image") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					flex: 1,
					display: "flex",
					flexDirection: "column",
					minHeight: 0
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						padding: "8px 16px",
						opacity: .65,
						display: "flex",
						gap: "12px",
						fontSize: "12px",
						borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.06))"
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: { fontWeight: 600 },
						children: reading.path
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						flex: 1,
						overflow: "auto",
						display: "flex",
						alignItems: "flex-start",
						justifyContent: "center",
						padding: "16px"
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						src: reading.url,
						alt: reading.path,
						style: {
							maxWidth: "100%",
							objectFit: "contain",
							borderRadius: "4px"
						}
					})
				})]
			});
			const markdown = isMarkdown(reading.path);
			const showPreview = markdown && preview;
			const lines = showPreview ? void 0 : toLines(reading.content);
			const previewSource = showPreview ? rewriteMarkdownImages(reading.content, sessionId ?? "", dirOf(reading.path)) : reading.content;
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
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: previewSource })
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						flex: 1,
						overflow: "auto",
						minHeight: 0
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ReadBlock, {
						lines: lines ?? [],
						totalLines: lines?.length ?? 0,
						lang: langFromPath(reading.path),
						maxLines: VIEWER_MAX_LINES,
						className: "web-files-code"
					})
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
				}, signal),
				search: (sessionId, query, signal) => call("search", {
					sessionId,
					request: { query }
				}, signal)
			};
		}
		//#endregion
		//#region src/client/locales.ts
		/** Browser copy for the files explorer, zh and en dictionaries. */
		const zh = {
			"view.files": "文件",
			"filter.placeholder": "筛选文件名…",
			"filter.clear": "清空筛选",
			"filter.noMatch": "无匹配文件（仅已加载目录）",
			"filter.loadedOnly": "递归搜索整个工作区",
			"search.searching": "递归搜索中…",
			"search.error": "搜索失败",
			"search.noMatch": "无匹配文件",
			"search.count": "{n} 个匹配",
			"search.truncated": "结果过多，仅显示开头部分",
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
			"filter.placeholder": "Filter files…",
			"filter.clear": "Clear filter",
			"filter.noMatch": "No matching files (loaded dirs only)",
			"filter.loadedOnly": "Searching the whole workspace recursively",
			"search.searching": "Searching…",
			"search.error": "Search failed",
			"search.noMatch": "No matching files",
			"search.count": "{n} matches",
			"search.truncated": "too many results; only the beginning is shown",
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