import { useState } from 'react';
import './App.css';
import {
    ThemeProvider,
    createTheme,
    GlobalStyles,
    CssBaseline,
} from '@mui/material';

import Fail2BanWebControl from './components/Fail2BanWebControl.jsx';

const getDesignTokens = (themeMode) => ({
    palette: {
        themeMode,
        ...(themeMode === 'light'
            ? {
                  background: { default: '#f7f7f7', paper: '#ffffff' },
                  text: { primary: '#222' },
                  divider: '#cccccc',
                  primary: { main: '#007bff' },
              }
            : {
                  background: { default: '#121212', paper: '#1e1e1e' },
                  text: { primary: '#e0e0e0' },
                  divider: '#333333',
                  primary: { main: '#4e8ef7' },
              }),
    },
});

function App() {
    const [themeMode, setThemeMode] = useState('dark');
    const theme = createTheme(getDesignTokens(themeMode));

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <GlobalStyles
                styles={{
                    ':root': {
                        '--bg-color': theme.palette.background.default,
                        '--text-color': theme.palette.text.primary,
                        '--card-bg': theme.palette.background.paper,
                        '--border-color': theme.palette.divider,
                        '--accent-color': theme.palette.primary.main,
                        '--button-text': '#ffffff',
                        '--muted-bg':
                            theme.palette.mode === 'light'
                                ? '#f0f0f0'
                                : '#2a2a2a',
                    },
                }}
            />
            <Fail2BanWebControl
                themeMode={themeMode}
                setThemeMode={setThemeMode}
            />
        </ThemeProvider>
    );
}

export default App;
