import './css/index.css'
import ReactDOM from 'react-dom/client'
import LaunchPage from './launchpage.tsx'
import Tracker from './tracker.tsx'

const isTracker =  new URLSearchParams(window.location.search).get('tracker') === 'true';
ReactDOM.createRoot(document.getElementById('root')!).render(

        (isTracker) ? <Tracker /> : <LaunchPage />

)
