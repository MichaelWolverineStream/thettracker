import './css/tracker.css'
import { useEffect, useState } from 'react';
import App from './App.tsx'
import { userSettingsProps } from './App.tsx'
import { ShouldStartProvider } from './timerContext.tsx'
import { parsePreviewSettings } from './config';

function Tracker() {
        
    const [userSettingsProps] = useState<userSettingsProps>(() => parsePreviewSettings(window.location.search));

    useEffect(() => {
        document.title = 'Stonks Tracker - v0.2.0-preview';
    }, []);

    return (
        <ShouldStartProvider>
            <App 
                checkCount={userSettingsProps.checkCount}
                bonks={userSettingsProps.bonks}
                chestTurns={userSettingsProps.chestTurns}
                deaths={userSettingsProps.deaths}
                rupees={userSettingsProps.rupees}
                screens={userSettingsProps.screens}
                damage={userSettingsProps.damage}
                magic={userSettingsProps.magic}
                boxes={userSettingsProps.boxes}
                appearance={userSettingsProps.appearance}
            />
        </ShouldStartProvider>
    )
}

export default Tracker