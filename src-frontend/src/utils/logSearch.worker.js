import { searchLog } from './logSearch.js';

self.onmessage = ({ data }) => {
    try {
        self.postMessage({ rows: searchLog(data.text, data.query, data.regex, data.matchCase) });
    } catch {
        self.postMessage({ error: 'Invalid regular expression. Please check the pattern.' });
    }
};
