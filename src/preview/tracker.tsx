import './css/tracker.css'
import { useEffect, useRef } from 'react';
import App from './App.tsx'
import { userSettingsProps } from './App.tsx'
import { ShouldStartProvider } from './timerContext.tsx'
import { parsePreviewSettings } from './config';

function Tracker() {
        
    const userSettingsProps = useRef<userSettingsProps>(parsePreviewSettings(window.location.search));

    useEffect(() => {
        document.title = 'Stonks Tracker - v0.2.0-preview';
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
                appearance={userSettingsProps.current.appearance}
            />
        </ShouldStartProvider>
    )
}

export default Tracker