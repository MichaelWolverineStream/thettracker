import { resolveVersion } from './versionRouting';

switch (resolveVersion(window.location.search)) {
        case 'legacy':
                void import('./legacy/main');
                break;
        case 'preview':
                void import('./preview/main');
                break;
        default:
                void import('./landing/main');
}
