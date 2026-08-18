var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { readFile } from 'node:fs/promises';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { installSettingsSection } from '@deepseek-ai/dsh-settings';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { z } from 'zod';
import { applyNotifyMarker } from "./marker.js";
import { SoundPlayer, defaultSoundName, soundsForPlatform } from "./sound.js";
import { DEFAULT_MAX_UPLOAD_BYTES, UploadRejectedError, UploadTooLargeError, audioExtensionsForPlatform, saveUpload } from "./sound-upload.js";
import { SESSION_NOTIFY_SETTINGS_NAMESPACE, SESSION_NOTIFY_SETTINGS_SCHEMA, } from "./settings.js";
/** Debounce for state-file writes, in milliseconds. */
const SAVE_DEBOUNCE_MS = 250;
/**
 * Session notification service (`ctx.sessionNotify`): the Host half of the
 * completion bell. Remote methods read/write the armed flag for the calling
 * session; the event listeners drive the sound at run completion.
 */
let SessionNotifyService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _getState_decorators;
    let _setArmed_decorators;
    let _preview_decorators;
    let _listSounds_decorators;
    let _getPrefs_decorators;
    let _setPrefs_decorators;
    return class SessionNotifyService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _getState_decorators = [Remote('getState')];
            _setArmed_decorators = [Remote('setArmed')];
            _preview_decorators = [Remote('preview')];
            _listSounds_decorators = [Remote('listSounds')];
            _getPrefs_decorators = [Remote('getPrefs')];
            _setPrefs_decorators = [Remote('setPrefs')];
            __esDecorate(this, null, _getState_decorators, { kind: "method", name: "getState", static: false, private: false, access: { has: obj => "getState" in obj, get: obj => obj.getState }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _setArmed_decorators, { kind: "method", name: "setArmed", static: false, private: false, access: { has: obj => "setArmed" in obj, get: obj => obj.setArmed }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _preview_decorators, { kind: "method", name: "preview", static: false, private: false, access: { has: obj => "preview" in obj, get: obj => obj.preview }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _listSounds_decorators, { kind: "method", name: "listSounds", static: false, private: false, access: { has: obj => "listSounds" in obj, get: obj => obj.listSounds }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getPrefs_decorators, { kind: "method", name: "getPrefs", static: false, private: false, access: { has: obj => "getPrefs" in obj, get: obj => obj.getPrefs }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _setPrefs_decorators, { kind: "method", name: "setPrefs", static: false, private: false, access: { has: obj => "setPrefs" in obj, get: obj => obj.setPrefs }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        /** Schema for the cordis.yml row; the same object serves constructor config. */
        static Config = z.object({
            /** Named macOS system sound (e.g. `Glass`) or an absolute audio file path. */
            sound: z.string().default('Glass'),
            /** `one-shot` plays once then auto-disarms; `sticky` keeps notifying until disarmed. */
            mode: z.enum(['one-shot', 'sticky']).default('one-shot'),
            /** afplay volume 0..1; macOS only. */
            volume: z.number().min(0).max(1).optional(),
            /** State-file override (tests); defaults under the dsh home. */
            stateFile: z.string().optional(),
            /** Custom-sound storage dir override (tests); defaults under the dsh home. */
            uploadDir: z.string().optional(),
            /** Maximum accepted custom-sound upload size in bytes. */
            maxUploadBytes: z.number().int().positive().default(DEFAULT_MAX_UPLOAD_BYTES),
        }).default(() => ({ sound: 'Glass', mode: 'one-shot', maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES }));
        /** Armed sessions (persisted): session id → armed flag. */
        armed = (__runInitializers(this, _instanceExtraInitializers), new Map());
        /** Sessions whose agent is currently running (in-memory only). */
        busy = new Set();
        /** Playback seam; tests override {@link playSound}. */
        player = new SoundPlayer();
        stateFile;
        uploadDir;
        maxUploadBytes;
        /** The authoritative playback config: the settings section while one is attached, the entry otherwise. */
        settingsSource;
        /**
         * Host-side settings handle for in-process writes. The browser settings
         * transport only accepts loopback clients, so the bell panel (reachable from
         * LAN IPs too) writes through this instead.
         */
        settingsApi = undefined;
        mode;
        sound;
        volume;
        saveTimer = null;
        /** Settles when persisted armed state has been read; state reads await it. */
        ready;
        constructor(ctx, config = { sound: 'Glass', mode: 'one-shot', maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES }) {
            super(ctx, 'sessionNotify');
            // Parse through the schema so field defaults apply for direct construction
            // (tests, embedded use) exactly as they do for cordis.yml rows.
            const resolved = SessionNotifyService.Config.parse(config);
            // The config default `Glass` is a "platform default" alias — on Windows
            // it resolves to the built-in `Windows Notify System Generic`.
            this.sound = resolved.sound === 'Glass' ? defaultSoundName() : resolved.sound;
            this.mode = resolved.mode;
            this.volume = resolved.volume;
            this.stateFile = resolved.stateFile ?? dshHomePath('plugins', 'dsh-session-notify', 'armed.json');
            this.uploadDir = resolved.uploadDir ?? dshHomePath('plugins', 'dsh-session-notify', 'sounds');
            this.maxUploadBytes = resolved.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
            this.settingsSource = () => ({ sound: this.sound, volume: this.volume ?? 1, mode: this.mode });
            this.ready = this.load();
            ctx.inject(['webServer'], (webCtx) => {
                ctx.effect(() => webCtx.webServer.register({
                    kind: 'exact',
                    path: '/plugins-session-notify/upload',
                    handler: (req, res) => {
                        void this.handleUpload(req, res);
                    },
                }), 'session-notify: sound upload route');
            });
            // User settings override the entry config as the composition base; changes
            // are hot-reloaded from `$DSH_HOME/settings.yaml` (no restart needed).
            installSettingsSection(ctx, SESSION_NOTIFY_SETTINGS_NAMESPACE, SESSION_NOTIFY_SETTINGS_SCHEMA, {
                sound: resolved.sound,
                mode: resolved.mode,
                ...(resolved.volume === undefined ? {} : { volume: resolved.volume }),
            }, {
                setSource: (current) => {
                    this.settingsSource = current;
                },
                onChange: () => {
                    const value = this.settingsSource();
                    this.sound = value.sound;
                    this.volume = value.volume;
                    this.mode = value.mode;
                },
            });
            ctx.inject(['settings'], (sctx) => {
                this.settingsApi = sctx.settings;
            });
            ctx.on('agent/status', ({ agent, status }) => this.onAgentStatus(agent.id, status));
            ctx.on('session/disposed', (session) => this.onSessionDisposed(session.id));
            ctx.on('agent/pre-step', (payload, next) => this.onPreStep(payload, next));
        }
        /** Current armed state for one session. */
        async getState(session) {
            await this.ready;
            return { armed: this.armed.get(session.id) ?? false };
        }
        /** Arm or disarm one session. */
        async setArmed(session, request) {
            if (request.armed) {
                this.armed.set(session.id, true);
            }
            else {
                this.armed.delete(session.id);
            }
            this.scheduleSave();
            return { armed: request.armed };
        }
        /** Play the configured sound immediately (sound preview / test). */
        async preview(_session, _request) {
            return { ok: this.playSound() };
        }
        /** Named sounds the host can play directly (built-in sounds for the platform). */
        async listSounds(_session, _request) {
            return { names: soundsForPlatform() };
        }
        /** The playback preferences currently in effect (settings-resolved). */
        async getPrefs(_session, _request) {
            await this.ready;
            return this.prefsSnapshot();
        }
        /**
         * Write playback preferences through the host-side settings service (in
         * process — the browser settings transport is loopback-only, so LAN clients
         * must go through here). Every present field is written; others are left
         * alone. The settings watch then refreshes the live playback config.
         */
        async setPrefs(_session, request) {
            const ops = [];
            if (request.sound !== undefined)
                ops.push({ op: 'set', path: ['sound'], value: request.sound });
            if (request.volume !== undefined)
                ops.push({ op: 'set', path: ['volume'], value: request.volume });
            if (request.mode !== undefined)
                ops.push({ op: 'set', path: ['mode'], value: request.mode });
            if (ops.length > 0) {
                if (this.settingsApi !== undefined) {
                    await this.settingsApi.mutate(SESSION_NOTIFY_SETTINGS_NAMESPACE, ops);
                }
                else {
                    // No settings service (headless/no-settings assembly): apply in memory.
                    this.applySettingsPatch(request);
                }
            }
            return this.prefsSnapshot();
        }
        /** The current playback prefs with absent optional fields omitted. */
        prefsSnapshot() {
            return {
                sound: this.sound,
                mode: this.mode,
                ...(this.volume === undefined ? {} : { volume: this.volume }),
            };
        }
        /** Direct in-memory application when the settings service is absent. */
        applySettingsPatch(request) {
            if (request.sound !== undefined)
                this.sound = request.sound;
            if (request.volume !== undefined)
                this.volume = request.volume;
            if (request.mode !== undefined)
                this.mode = request.mode;
        }
        /**
         * The custom-sound upload route: same-origin fence, POST body read as a raw
         * byte stream with extension + size caps, stored under the plugin's sounds
         * directory, and the stored absolute path returned so the client can save it
         * into the prefs.
         */
        async handleUpload(req, res) {
            const fail = (status, code) => {
                if (res.headersSent) {
                    res.destroy();
                    return;
                }
                res.writeHead(status, { 'content-type': 'text/plain' });
                res.end(code);
            };
            if (!this.isSameOrigin(req)) {
                fail(403, 'cross-origin denied');
                return;
            }
            if (req.method !== 'POST') {
                fail(405, 'method not allowed');
                return;
            }
            const url = new URL(req.url ?? '/', 'http://localhost');
            const name = url.searchParams.get('name') ?? '';
            try {
                const path = await saveUpload(this.uploadDir, name, req, this.maxUploadBytes, audioExtensionsForPlatform());
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ path }));
            }
            catch (error) {
                if (error instanceof UploadTooLargeError) {
                    fail(413, 'upload too large');
                }
                else if (error instanceof UploadRejectedError) {
                    fail(400, error.message);
                }
                else {
                    console.warn('[session-notify] sound upload failed:', error);
                    fail(500, 'upload failed');
                }
            }
        }
        /**
         * Same-origin fence for the upload route: a browser's own fetch to this
         * origin carries `Sec-Fetch-Site: same-origin`; a cross-site embed carries
         * `cross-site`. Non-browser clients (curl, tests) send no Sec-Fetch headers.
         */
        isSameOrigin(req) {
            const site = req.headers['sec-fetch-site'];
            if (site === undefined) {
                return req.headers.origin === undefined || req.headers.referer === undefined;
            }
            return site === 'same-origin' || site === 'same-site' || site === 'none';
        }
        /** The status listener: a run completing while armed plays the sound. */
        onAgentStatus(id, status) {
            if (status === 'running') {
                this.busy.add(id);
                return;
            }
            const wasBusy = this.busy.delete(id);
            if (!wasBusy)
                return;
            if (!(this.armed.get(id) ?? false))
                return;
            this.playSound();
            if (this.mode === 'one-shot') {
                this.armed.delete(id);
                this.scheduleSave();
            }
        }
        /** A disposed session must never notify; drop its state. */
        onSessionDisposed(id) {
            const hadArmed = this.armed.delete(id);
            const hadBusy = this.busy.delete(id);
            if (hadArmed || hadBusy)
                this.scheduleSave();
        }
        /** The pre-step waterfall: strip the notify marker and arm the session. */
        async onPreStep(payload, next) {
            const decision = await next();
            if (decision.kind !== 'enter')
                return decision;
            const result = applyNotifyMarker(decision.messages);
            if (!result.armed)
                return decision;
            this.armed.set(payload.agent.id, true);
            this.scheduleSave();
            return { kind: 'enter', messages: result.messages };
        }
        /** Playback seam: tests override this to count triggers without spawning. */
        playSound() {
            return this.player.play(this.sound, this.volume);
        }
        /** Restore persisted armed state; a corrupt file resets to empty with a warning. */
        async load() {
            let raw;
            try {
                raw = await readFile(this.stateFile, 'utf8');
            }
            catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn('[session-notify] failed to read armed state:', error);
                }
                return;
            }
            try {
                const parsed = JSON.parse(raw);
                if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
                    throw new Error('not a record');
                for (const [id, flag] of Object.entries(parsed)) {
                    if (typeof flag === 'boolean' && flag)
                        this.armed.set(id, true);
                }
            }
            catch (error) {
                console.warn(`[session-notify] armed state file ${this.stateFile} is corrupt; resetting:`, error);
                this.armed.clear();
                this.scheduleSave();
            }
        }
        /** Debounced atomic persistence of the armed map. */
        scheduleSave() {
            if (this.saveTimer !== null)
                clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => {
                this.saveTimer = null;
                const content = JSON.stringify(Object.fromEntries(this.armed), null, 2);
                void writeFileAtomic(this.stateFile, content, { mode: 0o600, dirMode: 0o700 }).catch((error) => {
                    console.warn(`[session-notify] failed to persist armed state to ${this.stateFile}:`, error);
                });
            }, SAVE_DEBOUNCE_MS);
        }
    };
})();
export { SessionNotifyService };
export default SessionNotifyService;
//# sourceMappingURL=index.js.map