import React, { useState, useRef } from 'react';

interface BoxProps {
    title: string;
    count: number;
    speed: number;
    unit: string;
    buckets: number[];
    colors: number[][];
}

function interpolateColor(color1: number[], color2: number[], fraction: number) {
    const red = color1[0] + fraction * (color2[0] - color1[0]);
    const green = color1[1] + fraction * (color2[1] - color1[1]);
    const blue = color1[2] + fraction * (color2[2] - color1[2]);
    return `rgb(${red}, ${green}, ${blue})`;
}

function Box({ title, count, speed, unit, buckets, colors }: BoxProps) {
    const calculateColor = (value: number, buckets: number[], colors: number[][]) => {
        const valueAdjusted = Math.min(Math.max(value, buckets[0]), buckets[buckets.length - 1]);
        let lowerBound = 0;
        let upperBound = 0;
        let lowerIndex = 0;
        let upperIndex = 0;
        for (let i = 0; i < buckets.length - 1; i++) {
            if (valueAdjusted >= buckets[i] && valueAdjusted <= buckets[i + 1]) {
                lowerBound = buckets[i];
                upperBound = buckets[i + 1];
                lowerIndex = i;
                upperIndex = i + 1;
                break;
            }
        }
        const speedfraction = (valueAdjusted - lowerBound) / (upperBound - lowerBound);
        const color1 = colors[lowerIndex];
        const color2 = colors[upperIndex];
        return interpolateColor(color1, color2, speedfraction);
    };
    let bgColor = calculateColor(speed, buckets, colors);
    return (
        <div className="flex flex-col items-center p-2">
            <p className="text-sm mt-2 text-gray-300 font-semibold tracking-wide uppercase">{title}</p>
            <div className="beveled-box rounded-lg p-4 w-20 h-20 flex items-center justify-center transform transition duration-500 hover:scale-110" style={{ backgroundColor: bgColor }} >
                <span className="font-bold text-slate-100 text-3xl" style={{ textShadow: '4px 4px 6px rgba(0,0,0,1.6)' }}>{count}</span>
            </div>
            <p className="text-sm text-gray-300 font-medium mt-2" style={{ textShadow: '4px 4px 8px rgba(0,0,0,1.2)', color: bgColor }}>{speed} {unit}</p>
        </div>
    );
    


}

export default Box;