import { useState, useEffect, useRef, MutableRefObject } from 'react';
import { useShouldStart } from './timerContext.tsx';

const RECONNECT_TIMEOUT = 5000;
const AUTOTRACK_TIMEOUT = 500;
const WRAM_START = 0xF50000; // $7E0000
const GAME_MODE = WRAM_START + 0x10;
const SRAM_START = 0xF5F000; // $7EF000
const SRAM_END = SRAM_START + 0x4FF;;
const ROOM_DATA_START = SRAM_START;
const ROOM_DATA_END = SRAM_START + 0x24F;
const OVERWORLD_EVENT_START = SRAM_START + 0x280;
const OVERWORLD_EVENT_END = SRAM_START + 0x2FF;
const SHOP_DATA_START = SRAM_START + 0x302;
const SHOP_DATA_END = SRAM_START + 0x33F;
const ITEM_DATA_START = SRAM_START + 0x340;
const ITEM_DATA_END = SRAM_START + 0x3F0;
const RANDOMIZER_DATA_START = SRAM_START + 0x3F1;
const RANDOMIZER_DATA_END = SRAM_START + 0x4FF;
const STATS_DATA_START = SRAM_START + 0x420;
const STATS_DATA_END = SRAM_START + 0x4FF;

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


export interface autotrackingProps {
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

function useAutoTrackWebSocket(props: autotrackingProps){
    const { shouldStart, setShouldStart, timerOn, setTimerOn } = useShouldStart();
    const shouldStartRef = useRef(shouldStart);
    const [data, setData] = useState<autotrackingProps>(props);
    const ws = useRef<WebSocket | null>();
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autotrackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevSRAM = useRef<Uint8Array | null>(null);
    const [currentSRAM, setSRAM] = useState<Uint8Array | null>(null);

    const dataRef = useRef(data);
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        shouldStartRef.current = shouldStart;
    }, [shouldStart]);

    const cleanup = () => {
        console.log("cleanup");
        clearTimeout(autotrackTimer.current!);
        clearTimeout(reconnectTimer.current!);
        autotrackTimer.current = null;
        reconnectTimer.current = null;
        ws.current = null;
    };

    const attemptReconnect = (trigger: string) => {
//        console.log("attemptReconnect: " + trigger);
        clearTimeout(reconnectTimer.current!);
        reconnectTimer.current = setTimeout(connect, RECONNECT_TIMEOUT);
    };

    const startAutotrackTimer = () => {
//        console.log("startAutotrackTimer");
        clearTimeout(autotrackTimer.current!);
        autotrackTimer.current = setTimeout(autotrackReadMem, AUTOTRACK_TIMEOUT);
    };

    const connect = () => {
        if (!data.port) {
            return ('Error: No host provided')
        }
        console.log("connect");
        reconnectTimer.current = null;
        if (ws.current) {
            console.log("Already connected or connecting");
            return;
        }

        setData(prev => ({ ...prev, status: 'Connecting'}));
        ws.current = new WebSocket(data.host + ':' + data.port.toString());
        ws.current.binaryType = 'arraybuffer';

        ws.current.onopen = (event: Event) => {
            console.log("onopen");
            setData(prev => ({ ...prev, status: 'Connected, requesting devices list'}));
            sendJSON({ Opcode: 'DeviceList', Space: 'SNES' });
            ws.current!.onmessage = handleDeviceList;
        };

        ws.current.onclose = (event: CloseEvent) => {
            console.log("onclose");
            cleanup();
            setData(prev => ({ ...prev, status: 'Disconnected: ' + event.reason}));
            attemptReconnect("onclose");
        };

        ws.current.onerror = (event: Event) => {
            console.log("onerror: " + event.type);
            cleanup();
            setData(prev => ({ ...prev, status: 'Error'}));
        };
    };

    const disconnect = () => {
        console.log("disconnect");
        if (ws.current) {
            ws.current.close();
        } else {
            cleanup();
            setData(prev => ({ ...prev, status: 'Disconnected'}));
            attemptReconnect("disconnect");
        }
        setData(prev => ({ ...prev, status: 'Disconnected'}));
    };

    // Send JSON data through the WebSocket
    const sendJSON = (jsondata: object) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(jsondata));
        }
    };

    const handleDeviceList = (event: MessageEvent) => {
        console.log("onDeviceList");
        let results = JSON.parse(event.data).Results;
        if (results.length < 1) {
            setData(prev => ({ ...prev, status: 'No devices found'}))
            disconnect();
            return;
        }
        const deviceName = results[0];
        sendJSON({ Opcode: 'Attach', Space: 'SNES', Operands: [deviceName] });
        setData(prev => ({ ...prev, status: 'Connected to ' + deviceName}))
        startAutotrackTimer();
    };

    const snesread = (address: Number, size: Number, callback: Function) => {
        ws.current!.send(JSON.stringify({
            Opcode: 'GetAddress',
            Space: 'SNES',
            Operands: [address.toString(16), size.toString(16)]
        }));
        ws.current!.onmessage = (event) => callback(event);
    };

    const autotrackReadMem = () => {
//        console.log("autotrackReadMem");
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current!); 
        attemptReconnect("autotrackReadMem");
        snesread(GAME_MODE, 1, function (event: MessageEvent) {
            let currentGamemode = new Uint8Array(event.data)[0];
            if (![GAME_MODE_MAP['DUNGEON'], GAME_MODE_MAP['OVERWORLD'], GAME_MODE_MAP['SPECIAL_OVERWORLD']].includes(currentGamemode)) {
                if (shouldStartRef.current && currentGamemode === GAME_MODE_MAP['TRIFORCE_ROOM']) {
                    setShouldStart(false);
                } else if (!shouldStartRef.current && currentGamemode === GAME_MODE_MAP['SELECT_SPAWN']) {
                    setShouldStart(true);
                }
            } else {
//                console.log("Autotracking: " + currentGamemode);
                if (!shouldStartRef.current) {
                    setShouldStart(true);
                }
                readSRAM();
            }
            startAutotrackTimer();
        });
    };

    const readSRAM = () => {
        snesread(SRAM_START, SRAM_END - SRAM_START, function (event: MessageEvent) {
            setSRAM(new Uint8Array(event.data));
        });
        console.log("ReadSRAM");
    };

    useEffect(() => {
        if (!currentSRAM) return;
        if (prevSRAM.current) {
            updateStats(currentSRAM);
        } else {
            initializeStats(currentSRAM);
        }
        prevSRAM.current = currentSRAM;
    }, [currentSRAM]);

    const initializeStats = (sram: Uint8Array) => {
        if (sram[MAX_CHECKS] != 0) {
            setData(prev => ({ ...prev, maxChecks: sram[MAX_CHECKS] + sram[MAX_CHECKS+1]*256}));
        }
    }

    const updateStats = (sram: Uint8Array) => {
        let updates = {};
        let currentCheckCount;

        if (data.maxChecks > 255) {
            currentCheckCount = sram[STATS_MAP['CHECKS']] + sram[STATS_MAP['CHECKS']+1]*256;
        } else {
            currentCheckCount = sram[STATS_MAP['CHECKS']];
        }
        if (currentCheckCount !== dataRef.current.checkCount) {
            updates = { ...updates,
                prevCheckCount: dataRef.current.checkCount,
                checkCount: currentCheckCount
            };
        }
        const currentBonks = sram[STATS_MAP['BONKS']];
        if (currentBonks !== dataRef.current.bonks) {
            updates = { ...updates, 
                bonks: currentBonks
            };
        }
        const currentChestTurns = sram[STATS_MAP['CHESTTURNS']];
        if (currentChestTurns !== dataRef.current.chestTurns) {
            updates = { ...updates,
                chestTurns: currentChestTurns
            };
        }

        const currentDeaths = sram[STATS_MAP['DEATHS']];
        if (currentDeaths !== dataRef.current.deaths) {
            updates = { ...updates,
                deaths: currentDeaths
            };
        }

        const currentRupees = sram[STATS_WORDS_MAP['RUPEES']] + sram[STATS_WORDS_MAP['RUPEES']+1]*256;
        if (currentRupees !== dataRef.current.rupees) {
            updates = { ...updates,
                rupees: currentRupees
            };
        }

        const currentScreens = sram[STATS_WORDS_MAP['SCREENS']] + sram[STATS_WORDS_MAP['SCREENS']+1]*256;
        if (currentScreens !== dataRef.current.screens) {
            updates = { ...updates,
                screens: currentScreens
            };
        }

        const currentDamage = sram[STATS_WORDS_MAP['DAMAGE']] + sram[STATS_WORDS_MAP['DAMAGE']+1]*256;
        if (currentDamage !== dataRef.current.damage) {
            updates = { ...updates,
                damage: currentDamage
            };
        }

        const currentMagic = sram[STATS_WORDS_MAP['MAGIC']] + sram[STATS_WORDS_MAP['MAGIC']+1]*256;
        if (currentMagic !== dataRef.current.magic) {
            updates = { ...updates,
                magic: currentMagic
            };
        }

        if (Object.keys(updates).length > 0) {
            setData(prev => ({ ...prev, ...updates}))
        }
    };

    useEffect(() => {
        connect();
        return () => {
            console.log("useEffect");
            disconnect();
        };
    }, [props.host]);
    
    return data;
}

export default useAutoTrackWebSocket;