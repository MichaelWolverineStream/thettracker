import './css/tracker.css'
import { useEffect, useRef } from 'react';
import App from './App.tsx'
import { userSettingsProps } from './App.tsx'
import { ShouldStartProvider } from './timerContext.tsx'

function Tracker() {
        
    const params = new URLSearchParams(window.location.search);
    const parseUrlBoxes = () => {
        const boxes = params.get('boxes');
        if (boxes === null) {
            return '3';
        }
        return boxes;
    };
    const userSettingsProps = useRef<userSettingsProps>({
        checkCount: params.get('checkCount') === 'true',
        bonks: params.get('bonks') === 'true',
        chestTurns: params.get('chestTurns') === 'true',
        deaths: params.get('deaths') === 'true',
        rupees: params.get('rupees') === 'true',
        screens: params.get('screens') === 'true',
        damage: params.get('damage') === 'true',
        magic: params.get('magic') === 'true',
        boxes: parseUrlBoxes()
    });

    useEffect(() => {
        document.title = 'Stonks Tracker - Checks Go Brrrr';
    }, []);

    return (
        <ShouldStartProvider>
            <App 
                checkCount={userSettingsProps.current.checkCount}
                bonks={userSettingsProps.current.bonks}
                chestTurns={userSettingsProps.current.chestTurns}
                deaths={userSettingsProps.current.deaths}
                rupees={userSettingsProps.current.rupees}
                screens={userSettingsProps.current.screens}
                damage={userSettingsProps.current.damage}
                magic={userSettingsProps.current.magic}
                boxes={userSettingsProps.current.boxes}
            />
        </ShouldStartProvider>
    )
}

export default Tracker