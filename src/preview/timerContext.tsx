import React, { useState } from 'react'

const ShouldStartContext = React.createContext<{
    shouldStart: boolean;
    setShouldStart: React.Dispatch<React.SetStateAction<boolean>>;
    timerOn: boolean;
    setTimerOn: React.Dispatch<React.SetStateAction<boolean>>;
  }>({
    shouldStart: false, setShouldStart: () => {},
    timerOn: false, setTimerOn: () => {}
  }
);

export const ShouldStartProvider = ({ children }: { children: React.ReactNode }) => {
  const [shouldStart, setShouldStart] = useState(false);
  const [timerOn, setTimerOn] = useState(false);
  return (
    <ShouldStartContext.Provider value={{ shouldStart, setShouldStart, timerOn, setTimerOn }}>
      {children}
    </ShouldStartContext.Provider>
  );
}

export const useShouldStart = () => {
    const context = React.useContext(ShouldStartContext);
    if (context === undefined) {
      throw new Error('useShouldStart must be used within a ShouldStartProvider');
    }
    return context;
}