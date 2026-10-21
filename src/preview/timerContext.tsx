import React, { useState } from 'react'
import { ShouldStartContext } from './useShouldStart'

export const ShouldStartProvider = ({ children }: { children: React.ReactNode }) => {
  const [shouldStart, setShouldStart] = useState(false);
  const [timerOn, setTimerOn] = useState(false);
  return (
    <ShouldStartContext.Provider value={{ shouldStart, setShouldStart, timerOn, setTimerOn }}>
      {children}
    </ShouldStartContext.Provider>
  );
}
