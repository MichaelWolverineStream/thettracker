import React, { useRef, useState } from 'react'
import useAutoTrackWebSocket from './autotrack.tsx'
import { AutotrackingProps } from './autotrack.tsx'
import { TimerProps } from './components/timer.tsx'
import useTimer from './components/timer.tsx'
import Box from './components/statbox.tsx'
import { useShouldStart } from './timerContext.tsx'
import { DEFAULT_TIMER_COLOR, LARGE_CHECK_BUCKETS, createSpeedMap, resolveAppearance, timerLanguage, timerStyles, variantOption, type AppearanceSettings } from './appearance';
import { useFittedTimer, useTimerFont } from './useTimerFont';
import { useTimerRotation } from './useTimerRotation';
import TimerFace from './components/TimerFace';
import BlatOverlay from './components/BlatOverlay';
import BeeBobble from './components/BeeBobble';
import { timerText } from './timerFormat';



export interface userSettingsProps {
  checkCount: boolean;
  bonks: boolean;
  chestTurns: boolean;
  deaths: boolean;
  rupees: boolean;
  screens: boolean;
  damage: boolean;
  magic: boolean;
  boxes: string;
  appearance?: AppearanceSettings;
}

function App(props: userSettingsProps) {
  const appearance = useRef(resolveAppearance(props.appearance)).current;
  const styles = useRef(timerStyles(appearance.timer)).current;
  const { timerOn, setTimerOn } = useShouldStart();
  const variant = variantOption(useTimerRotation(styles, timerOn));
  const blat = appearance.timer.blat === true;
  const language = timerLanguage(appearance.timer);
  const font = useTimerFont(appearance.timer);
  const family = variant.usesFont ? font.family : undefined;
  const customFamily = appearance.timer.font === 'custom' ? family : undefined;
  const timerElement = useRef<HTMLHeadingElement>(null);
  const SPEED_MAP = useRef(createSpeedMap(appearance));
  const [userSettings] = useState<userSettingsProps>(props);

  const timerProps = useRef<TimerProps>({
    timeStarted: 0,
    startAt: 0,
    duration: 0
  });
  const autotrackingProps = useRef<AutotrackingProps>({
    status: 'Disconnected',
    connected: false,
    host: 'ws://localhost',
    port: 23074,
    maxChecks: 216,
    checkCount: 0,
    chestTurns: 0,
    bonks: 0,
    deaths: 0,
    rupees: 0,
    screens: 0,
    damage: 0,
    magic: 0
  });
  const [manualCheckCount, setManualCheckCount] = useState<number>(0);
  const data = useAutoTrackWebSocket(autotrackingProps.current);
  const timer = useTimer(timerProps.current);
  if (data.maxChecks > 400) {
    SPEED_MAP.current['cph'].buckets = [...LARGE_CHECK_BUCKETS];
  }

  const displayMs = timer.hasStarted ? timer.duration + 1000 : 0;
  const fitKey = variant.layout === 'line' ? customFamily ?? (variant.value === 'digital' ? undefined : variant.value) : undefined;
  useFittedTimer(timerElement, fitKey, timerText(variant.value, displayMs, language), 36);
  const seconds = Math.floor(timer.duration / 1000);
  const hours = timer.duration / 3600000;

  const cph = seconds > 0 ? Math.round((data.checkCount + manualCheckCount) / (seconds / 3600)) : 0;
  const mBpm = seconds > 0 ? Math.round(data.bonks / (seconds / 60) * 1000) : 0;
  const ctph = hours > 0 ? Math.round(data.chestTurns / hours) : 0;
  const mdpm = seconds > 0 ? Math.round((data.deaths * 31557.6) / seconds) : 0;
  const rph = hours > 0 ? Math.round(data.rupees / hours) : 0;
  const sph = hours > 0 ? Math.round(data.screens / hours) : 0;
  const damage = Math.round(data.damage / 8);
  const dph = hours > 0 ? Math.round(damage / hours) : 0;
  const magic = Math.round(10 * data.magic / 128) / 10;
  const mph = hours > 0 ? Math.round((10 * data.magic / 128) / 10 / hours) : 0;
  
  const handleRightClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setManualCheckCount((prev) => prev - 1)
  };

  const throttleRef = useRef(false);
  const handleScroll = (event: React.WheelEvent<HTMLButtonElement>) => {
    if (!throttleRef.current) {
      throttleRef.current = true;
      setTimeout(() => {
        throttleRef.current = false;
      }, 175);

      if (event.deltaY > 0) {
        setManualCheckCount((prev) => prev - 1)
      } else if (event.deltaY < 0) {
        setManualCheckCount((prev) => prev + 1)
      }
    }
  };

  return (
    <>
      <div>
        <span className={`inline-grid gap-0 grid-cols-${userSettings.boxes}`}>
          {userSettings.checkCount && (
            <button onClick={() => setManualCheckCount((prev) => prev + 1)} onContextMenu={handleRightClick} onWheel={handleScroll}>
              <Box title="Checks" count={data.checkCount + manualCheckCount} speed={cph} unit="cph" buckets={SPEED_MAP.current['cph'].buckets} colors={SPEED_MAP.current['cph'].colors}/>
            </button>
          )}
          {userSettings.bonks && (
            <Box title="Bonks" count={data.bonks} speed={mBpm} unit="mBpm" buckets={SPEED_MAP.current['mBpm'].buckets} colors={SPEED_MAP.current['mBpm'].colors} />
          )}
          {userSettings.chestTurns && (
            <Box title="Chest Turns" count={data.chestTurns} speed={ctph} unit="ctph" buckets={SPEED_MAP.current['ctph'].buckets} colors={SPEED_MAP.current['ctph'].colors} />
          )}
          {userSettings.deaths && (
            <Box title="Deaths" count={data.deaths} speed={mdpm} unit="Mdpm" buckets={SPEED_MAP.current['Mdpm'].buckets} colors={SPEED_MAP.current['Mdpm'].colors} />
          )}
          {userSettings.rupees && (
            <Box title="Rupees Spent" count={data.rupees} speed={rph} unit="rph" buckets={SPEED_MAP.current['rph'].buckets} colors={SPEED_MAP.current['rph'].colors} />
          )}
          {userSettings.screens && (
            <Box title="Screens" count={data.screens} speed={sph} unit="sph" buckets={SPEED_MAP.current['sph'].buckets} colors={SPEED_MAP.current['sph'].colors} />
          )}
          {userSettings.damage && (
            <Box title="Hearts Lost" count={damage} speed={dph} unit="dph" buckets={SPEED_MAP.current['dph'].buckets} colors={SPEED_MAP.current['dph'].colors} />
          )}
          {userSettings.magic && (
            <Box title="Magic Bars" count={magic} speed={mph} unit="mph" buckets={SPEED_MAP.current['mph'].buckets} colors={SPEED_MAP.current['mph'].colors} />
          )}
        </span>
        <div className={appearance.timer.beebobble ? 'flex justify-center items-center mb-8' : 'flex justify-center items-center space-x-4 mb-8'} style={appearance.timer.beebobble ? { position: 'relative', paddingBottom: 60 } : undefined}>
          <div className="p-4" style={fitKey || blat ? {
            ...(fitKey ? { width: '100%', minWidth: 0, maxWidth: '100%' } : {}),
            ...(blat ? { position: 'relative' as const, overflow: 'clip' as const } : {}),
          } : undefined}>
              <h2 ref={timerElement} className="text-4xl font-bold text-blue-500" style={{
                textShadow: '2px 2px 3px rgba(0,0,0,0.5)',
                ...(appearance.timer.color !== DEFAULT_TIMER_COLOR ? { color: appearance.timer.color } : {}),
                ...(family ? { fontFamily: family } : {}),
                ...(fitKey ? { width: '100%', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: '40px' } : {}),
              }}>
                <TimerFace variant={variant.value} ms={displayMs} language={language} />
              </h2>
              {blat && timerOn && <BlatOverlay size={18} color={appearance.timer.color} />}
          </div>
          {appearance.timer.beebobble && <BeeBobble />}
        </div>

        {!timer.hasStarted && !data.connected && (
          <div className="flex justify-center items-center space-x-4 mb-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 active:bg-blue-800 text-gray-100 strong-button-font py-2 px-3 beveled-box rounded-md flex items-center justify-center gap-2 transition-all duration-150 ease-in-out active:shadow-inner active:scale-95"
              onClick={() => setTimerOn(true)}
            >
              FORCE TIMER START
            </button>
          </div>
        )}

        {timer.hasStarted && (
          <div className="flex justify-center items-center space-x-4 mb-4">
            <button
                className="bg-blue-500 hover:bg-blue-700 text-white beveled-box font-bold py-1 px-3 rounded flex items-center justify-center gap-2 w-10 h-10 transition-all duration-150 ease-in-out"
                onClick={() => setTimerOn(!timerOn)}
            >
              {timerOn ? (
                <>
                    {/* Pause icon: Two divs for the vertical bars, slightly adjusted for new button size */}
                    <div className="w-1.5 h-5 bg-white"></div>
                    <div className="w-1.5 h-5 bg-white"></div>
                </>
                ) : (
                <>
                    {/* Play (Start) icon: Adjusted triangle for a balanced look within the new button size */}
                    <div className="w-0 h-0 border-t-[7.5px] border-b-[7.5px] border-l-[15px] border-transparent border-l-white"></div>
                </>
              )}
            </button>
            <button
              className="bg-purple-900 hover:bg-purple-800 active:bg-red-700 text-gray-100 strong-button-font py-2 px-3 beveled-box rounded-md flex items-center justify-center gap-2 transition-all duration-150 ease-in-out text-s active:shadow-inner active:scale-95"
              onClick={() => setManualCheckCount(0)}
            >
              DE-FLUFF
            </button>
          </div>
        )}

      <div className="flex justify-center items-center space-x-4">
        <small className="hover:text-orange-400">{data.status}</small>
      </div>


    </div>

    </>
  )
}

export default App
