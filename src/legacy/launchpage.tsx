import './css/launchpage.css';
import React, { useState, useRef } from 'react';
import Checkbox from './components/checkbox.tsx';
import widgetData from './data/widgets.json';

interface Settings {
    [key: string]: boolean;
}

const LaunchPage = () => {
    const initialSettings: Settings = widgetData.reduce((acc, curr) => {
        acc[curr.name] = true;
        return acc;
    }, {} as Settings);
    const [settings, setSettings] = useState<Settings>(initialSettings);

    
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        const determineBoxCount = (settings: Settings) => {
            const currentCount = Object.entries(settings).filter(([_, value]) => value).length;
            switch (currentCount) {
                case 0:
                    return 1;
                case 1:
                    return 1;
                case 2:
                    return 2;
                case 3:
                    return 3;
                case 4:
                    return 4;
                case 5:
                    return 3;
                case 6:
                    return 3;
                case 7:
                    return 4;
                case 8:
                    return 4;
                default:
                    return 4;
            }
        };

        event.preventDefault();
        const boxCount = determineBoxCount(settings);
        const queryParams = new URLSearchParams(Object.entries(settings).filter(([_, value]) => value).map(([key, value]) => [key, String(value)])).toString();
        const windowFeatures = "width=600, height=600, menubar=no, toolbar=no, location=no, status=no, resizable=yes, scrollbars=yes";
        window.open(`./index.html?tracker=true&${queryParams}&boxes=${boxCount}`, '_blank', windowFeatures);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;
        setSettings((prev) => ({
            ...prev,
            [name]: checked
        }));
    };

    return (
        <>
        <div className="flex justify-center items-center mb-12 font-semibold">
            <h1>Auto Stats v0.0.43</h1>
        </div>
        <div className="flex justify-center items-center mb-12 font-semibold">
        <h3>by StructuralMike</h3>
        </div>
        <div className="flex justify-center items-center mt-8">
            <form onSubmit={handleSubmit} className="space-y-4">
            <Checkbox checked={settings.checkCount} handleChange={handleChange} name="checkCount" label="Checks (checks per hour)" />
            <Checkbox checked={settings.bonks} handleChange={handleChange} name="bonks" label="Bonks (milliBonks per minute)" />
            <Checkbox checked={settings.chestTurns} handleChange={handleChange} name="chestTurns" label="Chest Turns (chest turns per hour)" />
            <Checkbox checked={settings.deaths} handleChange={handleChange} name="deaths" label="Deaths (megadeaths per millenia)" />
            <Checkbox checked={settings.rupees} handleChange={handleChange} name="rupees" label="Rupees (rupees spent per hour)" />
            <Checkbox checked={settings.screens} handleChange={handleChange} name="screens" label="Screen Transitions (screens per hour)" />
            <Checkbox checked={settings.damage} handleChange={handleChange} name="damage" label="Damage Taken (hearts spent per hour)" />
            <Checkbox checked={settings.magic} handleChange={handleChange} name="magic" label="Magic Used (magic bars per hour)" />
            <button type="submit" className="bg-slate-900 hover:bg-slate-700 active:bg-red-700 text-gray-100 py-2 px-3 beveled-box rounded-md flex items-center justify-center gap-2 transition-all duration-150 ease-in-out text-s active:shadow-inner active:scale-95">
                Launch
            </button>
            </form>
        </div>
        </>
    );
};

export default LaunchPage;
