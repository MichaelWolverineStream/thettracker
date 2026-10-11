import { useState, useEffect, useRef } from 'react';
import { useShouldStart } from './timerContext.tsx';

const RECONNECT_TIMEOUT = 5000;
const AUTOTRACK_TIMEOUT = 125;
const WRAM_START = 0xF50000;
const GAME_MODE = WRAM_START + 0x10;
const SRAM_START = 0xF5F000;
const SRAM_SIZE = 0x4FF;

const STATS_MAP = {
    'BONKS': 0x420,
    'CHECKS': 0x423,
    'SAVE_AND_QUIT': 0x42D,
    'HEARTPIECES': 0x448,
    'DEATHS': 0x449,
    'FLUTES': 0x44B,
    'REVIVALS': 0x453,
    'CHESTTURNS': 0x468,
    'OVERWORLDMIRRORS': 0x43A,
    'DUNGEONMIRRORS': 0x43B,
}

const STATS_WORDS_MAP = {
    'RUPEES': 0x42B,
    'SCREENS': 0x43C,
    'DAMAGE': 0x46A,
    'MAGIC': 0x46C
}

const MAX_CHECKS = 0x33E;

const GAME_MODE_MAP = {
    'STARTUP': 0x00,
    'GAME_SELECT': 0x01,
    'DUNGEON': 0x07,
    'OVERWORLD': 0x09,
    'SPECIAL_OVERWORLD': 0x0B,
    'TEXT_MAP_ITEM': 0x0E,
    'SAVE_QUIT': 0x17,
    'TRIFORCE_ROOM': 0x19,
    'SELECT_SPAWN': 0x1B,
};


export interface AutotrackingProps {
    status: string;
    host?: string;
    port?: number;
    maxChecks: number;
    checkCount: number;
    prevCheckCount?: number;
    chestTurns: number;
    bonks: number;
    deaths: number;
    rupees: number;
    screens: number;
    damage: number;
    magic: number;
}

function useAutoTrackWebSocket(props: AutotrackingProps) {
    const { setShouldStart } = useShouldStart();
    const [data, setData] = useState(props);
    const initialized = useRef(false);

    useEffect(() => {
        let mounted = true;
        let socket: WebSocket | null = null;
        let phase: 'opening' | 'devices' | 'mode' | 'sram' | 'idle' = 'idle';
        let pollTimer: ReturnType<typeof setTimeout> | undefined;
        let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let lastModeRequest = 0;

        function clearTimers() {
            clearTimeout(pollTimer);
            clearTimeout(deadlineTimer);
            clearTimeout(retryTimer);
            pollTimer = deadlineTimer = retryTimer = undefined;
        }

        function disposeSocket() {
            const owned = socket;
            socket = null;
            phase = 'idle';
            if (!owned) return;
            owned.onopen = owned.onmessage = owned.onerror = owned.onclose = null;
            if (owned.readyState === WebSocket.OPEN || owned.readyState === WebSocket.CONNECTING) owned.close();
        }

        function recover(status: string) {
            if (!mounted || retryTimer !== undefined) return;
            clearTimers();
            disposeSocket();
            setData(previous => ({ ...previous, status }));
            retryTimer = setTimeout(() => {
                retryTimer = undefined;
                connect();
            }, RECONNECT_TIMEOUT);
        }

        function armDeadline() {
            clearTimeout(deadlineTimer);
            deadlineTimer = setTimeout(() => recover('Disconnected: SNI response timed out'), RECONNECT_TIMEOUT);
        }

        function send(command: object): boolean {
            if (!mounted || socket?.readyState !== WebSocket.OPEN) {
                recover('Disconnected');
                return false;
            }
            try {
                socket.send(JSON.stringify(command));
                return true;
            } catch {
                recover('Error');
                return false;
            }
        }

        function request(command: object, nextPhase: 'devices' | 'mode' | 'sram') {
            if (phase !== 'idle') return;
            phase = nextPhase;
            armDeadline();
            send(command);
        }

        function requestDevices() {
            request({ Opcode: 'DeviceList', Space: 'SNES' }, 'devices');
        }

        function requestMode() {
            pollTimer = undefined;
            lastModeRequest = Date.now();
            request({ Opcode: 'GetAddress', Space: 'SNES', Operands: [GAME_MODE.toString(16), '1'] }, 'mode');
        }

        function scheduleMode() {
            const delay = Math.max(0, AUTOTRACK_TIMEOUT - (Date.now() - lastModeRequest));
            pollTimer = setTimeout(requestMode, delay);
        }

        function updateStats(sram: Uint8Array) {
            const word = (offset: number) => sram[offset] + sram[offset + 1] * 256;
            if (!initialized.current) {
                initialized.current = true;
                if (sram[MAX_CHECKS] !== 0) setData(previous => ({ ...previous, maxChecks: word(MAX_CHECKS) }));
                return;
            }
            setData(previous => {
                const checkCount = previous.maxChecks > 255 ? word(STATS_MAP.CHECKS) : sram[STATS_MAP.CHECKS];
                return {
                    ...previous,
                    ...(checkCount !== previous.checkCount ? { prevCheckCount: previous.checkCount } : {}),
                    checkCount,
                    bonks: sram[STATS_MAP.BONKS],
                    chestTurns: sram[STATS_MAP.CHESTTURNS],
                    deaths: sram[STATS_MAP.DEATHS],
                    rupees: word(STATS_WORDS_MAP.RUPEES),
                    screens: word(STATS_WORDS_MAP.SCREENS),
                    damage: word(STATS_WORDS_MAP.DAMAGE),
                    magic: word(STATS_WORDS_MAP.MAGIC),
                };
            });
        }

        function handleMessage(event: MessageEvent) {
            const responsePhase = phase;
            if (responsePhase === 'idle' || responsePhase === 'opening') return;
            clearTimeout(deadlineTimer);
            deadlineTimer = undefined;
            phase = 'idle';

            try {
                if (responsePhase === 'devices') {
                    if (typeof event.data !== 'string') throw new Error('Invalid device list');
                    const results: unknown = JSON.parse(event.data).Results;
                    if (!Array.isArray(results) || !results.every(device => typeof device === 'string')) throw new Error('Invalid device list');
                    if (results.length === 0) {
                        setData(previous => ({ ...previous, status: 'No devices found' }));
                        pollTimer = setTimeout(requestDevices, RECONNECT_TIMEOUT);
                        return;
                    }
                    if (!send({ Opcode: 'Attach', Space: 'SNES', Operands: [results[0]] })) return;
                    setData(previous => ({ ...previous, status: `Connected to ${results[0]}` }));
                    pollTimer = setTimeout(requestMode, AUTOTRACK_TIMEOUT);
                    return;
                }

                if (!(event.data instanceof ArrayBuffer)) throw new Error('Invalid memory response');
                const bytes = new Uint8Array(event.data);
                if (bytes.length !== (responsePhase === 'mode' ? 1 : SRAM_SIZE)) throw new Error('Invalid memory response length');
                if (responsePhase === 'sram') {
                    updateStats(bytes);
                    scheduleMode();
                    return;
                }

                const gameMode = bytes[0];
                if ([GAME_MODE_MAP.DUNGEON, GAME_MODE_MAP.OVERWORLD, GAME_MODE_MAP.SPECIAL_OVERWORLD].includes(gameMode)) {
                    setShouldStart(true);
                    request({ Opcode: 'GetAddress', Space: 'SNES', Operands: [SRAM_START.toString(16), SRAM_SIZE.toString(16)] }, 'sram');
                    return;
                }
                if (gameMode === GAME_MODE_MAP.TRIFORCE_ROOM) setShouldStart(false);
                else if (gameMode === GAME_MODE_MAP.SELECT_SPAWN) setShouldStart(true);
                scheduleMode();
            } catch {
                recover('Error: Invalid SNI response');
            }
        }

        function connect() {
            if (!mounted || socket) return;
            setData(previous => ({ ...previous, status: 'Connecting' }));
            try {
                const owned = new WebSocket(`${props.host}:${props.port}`);
                socket = owned;
                phase = 'opening';
                owned.binaryType = 'arraybuffer';
                const isCurrent = () => mounted && socket === owned;
                owned.onopen = () => {
                    if (!isCurrent()) return;
                    clearTimeout(deadlineTimer);
                    phase = 'idle';
                    setData(previous => ({ ...previous, status: 'Connected, requesting devices list' }));
                    requestDevices();
                };
                owned.onmessage = event => { if (isCurrent()) handleMessage(event); };
                owned.onerror = () => { if (isCurrent()) recover('Error'); };
                owned.onclose = event => { if (isCurrent()) recover(`Disconnected: ${event.reason}`); };
                armDeadline();
            } catch {
                recover('Error');
            }
        }

        connect();
        return () => {
            mounted = false;
            clearTimers();
            disposeSocket();
        };
    }, [props.host, props.port, setShouldStart]);

    return data;
}

export default useAutoTrackWebSocket;