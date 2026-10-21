import React from 'react'

export const ShouldStartContext = React.createContext<{
    shouldStart: boolean;
    setShouldStart: React.Dispatch<React.SetStateAction<boolean>>;
    timerOn: boolean;
    setTimerOn: React.Dispatch<React.SetStateAction<boolean>>;
  }>({
    shouldStart: false, setShouldStart: () => {},
    timerOn: false, setTimerOn: () => {}
  }
);

export const useShouldStart = () => {
    const context = React.useContext(ShouldStartContext);
    if (context === undefined) {
      throw new Error('useShouldStart must be used within a ShouldStartProvider');
    }
    return context;
}
