import ReactDOM from 'react-dom/client';
import '../preview/fonts.css';
import LaunchPage from './LaunchPage';

document.title = 'Auto Stats';
ReactDOM.createRoot(document.getElementById('root')!).render(<LaunchPage />);