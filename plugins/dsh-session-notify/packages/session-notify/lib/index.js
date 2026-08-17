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
/**
 * Per-session completion notification for the dsh Web client.
 *
 * The Host half: a Typert Remote service exposing the arm/state/preview wire
 * surface plus three root event listeners that implement the notification
 * state machine —
 *
 *  - `agent/status`: a run is the `running` → `idle` transition of a
 *    session's agent. A session armed at that moment plays the configured
 *    sound and (in one-shot mode) auto-disarms. Using the status event rather
 *    than `turn/end` makes a whole run (all its steps and tool calls, and
 *    every turn a goal round drives) the notification unit.
 *  - `session/disposed`: a removed session never notifies; its armed and
 *    busy state is cleaned up.
 *  - `agent/pre-step`: the `!notify` / `🔔` message marker arms the session
 *    and is stripped from the messages entering the step.
 *
 * Armed state is persisted (debounced, atomic) under
 * `$DSH_HOME/plugins/dsh-session-notify/armed.json` so it survives restarts.
 */
import { readFile } from 'node:fs/promises';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { z } from 'zod';
import { applyNotifyMarker } from "./marker.js";
import { SoundPlayer } from "./sound.js";
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
    return class SessionNotifyService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _getState_decorators = [Remote('getState')];
            _setArmed_decorators = [Remote('setArmed')];
            _preview_decorators = [Remote('preview')];
            __esDecorate(this, null, _getState_decorators, { kind: "method", name: "getState", static: false, private: false, access: { has: obj => "getState" in obj, get: obj => obj.getState }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _setArmed_decorators, { kind: "method", name: "setArmed", static: false, private: false, access: { has: obj => "setArmed" in obj, get: obj => obj.setArmed }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _preview_decorators, { kind: "method", name: "preview", static: false, private: false, access: { has: obj => "preview" in obj, get: obj => obj.preview }, metadata: _metadata }, null, _instanceExtraInitializers);
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
        }).default(() => ({ sound: 'Glass', mode: 'one-shot' }));
        /** Armed sessions (persisted): session id → armed flag. */
        armed = (__runInitializers(this, _instanceExtraInitializers), new Map());
        /** Sessions whose agent is currently running (in-memory only). */
        busy = new Set();
        /** Playback seam; tests override {@link playSound}. */
        player = new SoundPlayer();
        stateFile;
        mode;
        sound;
        volume;
        saveTimer = null;
        /** Settles when persisted armed state has been read; state reads await it. */
        ready;
        constructor(ctx, config = { sound: 'Glass', mode: 'one-shot' }) {
            super(ctx, 'sessionNotify');
            // Parse through the schema so field defaults apply for direct construction
            // (tests, embedded use) exactly as they do for cordis.yml rows.
            const resolved = SessionNotifyService.Config.parse(config);
            this.sound = resolved.sound;
            this.mode = resolved.mode;
            this.volume = resolved.volume;
            this.stateFile = resolved.stateFile ?? dshHomePath('plugins', 'dsh-session-notify', 'armed.json');
            this.ready = this.load();
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