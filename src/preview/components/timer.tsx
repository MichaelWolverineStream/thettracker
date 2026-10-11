import { useState, useEffect, useRef } from 'react';
import { useShouldStart } from '../timerContext';

export interface TimerProps {
    timeStarted: number;
    startAt: number;
    duration: number;
}

function useTimer(props: TimerProps) {
    const { shouldStart, timerOn, setTimerOn } = useShouldStart();
    const [timerData, setTimerData] = useState<TimerProps & { hasStarted: boolean }>({ ...props, hasStarted: false });
    const accumulated = useRef(props.startAt);

    useEffect(() => {
        setTimerOn(shouldStart);
    }, [shouldStart, setTimerOn]);

    useEffect(() => {
        if (!timerOn) {
            setTimerData(previous => ({ ...previous, startAt: accumulated.current, duration: accumulated.current }));
            return;
        }

        const started = Date.now();
        setTimerData({ timeStarted: started, startAt: accumulated.current, duration: accumulated.current, hasStarted: true });
        const interval = setInterval(() => {
            setTimerData(previous => ({ ...previous, duration: accumulated.current + Date.now() - started }));
        }, 125);

        return () => {
            clearInterval(interval);
            accumulated.current += Date.now() - started;
        };
    }, [timerOn]);

    return timerData
}

export default useTimer;