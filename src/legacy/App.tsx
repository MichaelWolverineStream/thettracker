import React, { useEffect, useRef, useState } from 'react'
import useAutoTrackWebSocket from './autotrack.tsx'
import { autotrackingProps } from './autotrack.tsx'
import { TimerProps } from './components/timer.tsx'
import Timer from './components/timer.tsx'
import Box from './components/statbox.tsx'
import { useShouldStart } from './timerContext.tsx'



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
};

function App(props: userSettingsProps) {
  const SPEED_MAP = useRef({
    'cph': {'buckets': [70, 85, 100, 115, 130], 'colors': [[58,134,255], [131,56,236], [255,0,110], [251,86,7], [255,190,11]]},
    'mBpm': {'buckets': [0, 100, 200, 400, 800], 'colors': [[255,190,11], [251,86,7], [255,0,110], [131,56,236], [58,134,255]]},
    'ctph': {'buckets': [0, 10, 25], 'colors': [[58,134,255], [251,86,7], [255,190,11]]},
    'Mdpm': {'buckets': [0, 1, 5, 20, 50], 'colors': [[255,190,11], [251,86,7], [255,0,110], [131,56,236], [58,134,255]]},
    'rph': {'buckets': [0, 1000, 3000], 'colors': [[58,134,255], [255,0,110], [255,190,11]]},
    'sph': {'buckets': [0, 400, 800], 'colors': [[58,134,255], [255,0,110], [255,190,11]]},
    'dph': {'buckets': [0, 25, 100], 'colors': [[58,134,255], [255,0,110], [255,190,11]]},
    'mph': {'buckets': [0, 50, 100, 200, 400], 'colors': [[58,134,255], [131,56,236], [255,0,110], [251,86,7], [255,190,11]]}
  });
  const [userSettings, setUserSettings] = useState<userSettingsProps>(props);

  const timerProps = useRef<TimerProps>({
    timeStarted: 0,
    startAt: 0,
    duration: 0
  });
  const autotrackingProps = useRef<autotrackingProps>({
    status: 'Disconnected',
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
  const { shouldStart, setShouldStart, timerOn, setTimerOn } = useShouldStart();
  const [manualCheckCount, setManualCheckCount] = useState<number>(0);
  const data = useAutoTrackWebSocket(autotrackingProps.current);
  const timer = Timer(timerProps.current);
  if (data.maxChecks > 400) {
    SPEED_MAP.current['cph'].buckets = [150, 250, 350, 450, 550]
  };

  const duration = new Date(timer.duration + 1500).toISOString().substr(11, 8);
  const seconds = Math.floor(timer.duration / 1000);
  const hours = timer.duration / 3600000;

  const cph = Math.round((data.checkCount + manualCheckCount) / (seconds / 3600));
  const mBpm = Math.round(data.bonks / (seconds / 60) * 1000);
  const ctph = Math.round(data.chestTurns / hours);
  const mdpm = Math.round((data.deaths * 31557.6) / seconds);
  const rph = Math.round(data.rupees / hours);
  const sph = Math.round(data.screens / hours);
  const damage = Math.round(data.damage / 8);
  const dph = Math.round(damage / hours);
  const magic = Math.round(10 * data.magic / 128) / 10;
  const mph = Math.round((10 * data.magic / 128) / 10 / hours);
  
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
        <div className="flex justify-center items-center space-x-4 mb-8">
          <div className="p-4">
              <h2 className="text-4xl font-bold text-blue-500" style={{ textShadow: '2px 2px 3px rgba(0,0,0,0.5)' }}>
                {timer.duration > 1500 ? 
                  duration
                : (
                  "00:00:00"
                )}
              </h2>
          </div>
        </div>

        {timer.duration > 1500 && (
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
              onClick={() => setManualCheckCount((prev) => 0)}
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
