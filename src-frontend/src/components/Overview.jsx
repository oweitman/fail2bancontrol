import { useState, useCallback, useEffect } from 'react';
import {
    Box,
    Card,
    CardHeader,
    CardContent,
    Chip,
    Stack,
    Grid,
    Tooltip,
    Button,
    IconButton,
    Typography,
    TextField,
    Snackbar,
    Alert,
} from '@mui/material';

import StopIcon from '@mui/icons-material/Stop'; //stop
import PlayArrowIcon from '@mui/icons-material/PlayArrow'; //start
import RestartAltIcon from '@mui/icons-material/RestartAlt'; //restart
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt'; //reload
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

import LogLevelSlider from './LogLevelSlider.jsx';

const StartIcon = PlayArrowIcon;
const RestartIcon = RestartAltIcon;
const ReloadIcon = SystemUpdateAltIcon;

async function postJSON(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `${res.status} ${res.statusText}`);
    }
    return res.json().catch(() => ({}));
}
export default function Overview({ list, themeMode, setThemeMode, error }) {
    const [version, setVersion] = useState('');
    const [loglevel, setLoglevel] = useState('');
    const [dbfile, setDbfile] = useState('');
    const [dbMaxMatches, setDbMaxMatches] = useState('');
    const [inputDbMaxMatches, setInputDbMaxMatches] = useState('');
    const [dbPurgeAge, setDbPurgeAge] = useState('');
    const [inputDbPurgeAge, setInputDbPurgeAge] = useState('');
    const [busy, setBusy] = useState(false);
    const [snack, setSnack] = useState({
        open: false,
        severity: 'success',
        msg: '',
    });

    const styles = {
        card: {
            minWidth: '900px',
            margin: '15px 0px',
            padding: '12px 15px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        },
        cardheader: {
            textAlign: 'left',
            padding: '8px',
            color: 'var(--text-color)',
        },
        cardcontent: {
            padding: '8px',
        },
        jailcount: {
            margin: '0px 8px 16px',
        },
        chip: {
            flex: '0 0 10px',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            backgroundColor: 'rgba(128, 128, 128, 0.2)',
        },
        iconbutton: {
            transition: 'transform 0.2s ease-in-out',
            '&:hover': {
                transform: 'scale(1.2)',
            },
            color: 'var(--text-color)',
        },
    };
    const loadInfo = useCallback(async () => {
        try {
            const [v, ll, dbf, mm, pa] = await Promise.all([
                fetchJSON('/api/version').catch(() => ({ version: '' })),
                fetchJSON('/api/loglevel').catch(() => ({ loglevel: '' })),
                fetchJSON('/api/db/file').catch(() => ({ dbfile: '' })),
                fetchJSON('/api/db/maxmatches').catch(() => ({
                    dbmaxmatches: '',
                })),
                fetchJSON('/api/db/purgeage').catch(() => ({ dbpurgeage: '' })),
            ]);
            setVersion(v.version.split('\n')[1] || '');
            setLoglevel(String(ll.loglevel.split('\n')[1] || ''));
            setDbfile(dbf.dbfile.split('\n')[1] || '');
            setDbMaxMatches(String(mm.dbmaxmatches.split('\n')[1] || ''));
            setInputDbMaxMatches(String(mm.dbmaxmatches.split('\n')[1] || ''));
            setDbPurgeAge(String(pa.dbpurgeage.split('\n')[1] || ''));
            setInputDbPurgeAge(String(pa.dbpurgeage.split('\n')[1] || ''));
        } catch (e) {
            showErr(e);
        }
    }, []);
    const call = useCallback(
        async (fn, successMsg) => {
            setBusy(true);
            try {
                const res = await fn();
                showOk(successMsg || res.result || 'OK');
                await loadInfo(); // loadInfo ist via useCallback stabil
            } catch (e) {
                showErr(e);
            } finally {
                setBusy(false);
            }
        },
        [loadInfo]
    );
    // server basic
    const onStart = () =>
        call(() => postJSON('/api/server/start'), 'Server started');
    const onRestart = () =>
        call(() => postJSON('/api/server/restart'), 'Server restarted');
    const onReload = () =>
        call(
            () =>
                postJSON(
                    '/api/server/reload' /* , {
                restart: srvReloadRestart,
                unban: srvReloadUnban,
                all: srvReloadAll,
            } */
                ),
            'Server reload issued'
        );
    const onStop = () =>
        call(() => postJSON('/api/server/stop'), 'Server stopped');

    const onSetMaxMatches = useCallback(
        (val) =>
            call(
                () =>
                    postJSON('/api/db/maxmatches', { value: Number(val) || 0 }),
                'dbmaxmatches updated'
            ),
        [call]
    );

    const onSetPurgeAge = useCallback(
        (seconds) =>
            call(
                () =>
                    postJSON('/api/db/purgeage', {
                        seconds: Number(seconds) || 0,
                    }),
                'dbpurgeage updated'
            ),
        [call]
    );

    const onSetLoglevel = useCallback(
        (loglvl) =>
            call(
                () => postJSON('/api/loglevel', { level: loglvl }),
                `Log level set to ${loglvl}`
            ),
        [call]
    );

    useEffect(() => {
        if (inputDbMaxMatches === '' || inputDbMaxMatches === dbMaxMatches)
            return;
        const t = setTimeout(() => {
            const n = Number(inputDbMaxMatches);
            if (!Number.isFinite(n) || n < 0) return;
            onSetMaxMatches(n);
        }, 1000);
        return () => clearTimeout(t);
    }, [inputDbMaxMatches, dbMaxMatches, onSetMaxMatches]);

    useEffect(() => {
        if (inputDbPurgeAge === '' || inputDbPurgeAge === dbPurgeAge) return;
        const t = setTimeout(() => {
            const n = Number(inputDbPurgeAge);
            if (!Number.isFinite(n) || n < 0) return;
            onSetPurgeAge(n); // jetzt passt Signatur
        }, 1000);
        return () => clearTimeout(t);
    }, [inputDbPurgeAge, dbPurgeAge, onSetPurgeAge]);

    useEffect(() => {
        loadInfo();
    }, [loadInfo]);

    const showOk = (msg) => setSnack({ open: true, severity: 'success', msg });
    const showErr = (err) =>
        setSnack({
            open: true,
            severity: 'error',
            msg: typeof err === 'string' ? err : err.message || 'Error',
        });

    async function fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
    }

    return (
        <>
            <Card id={`overview`} sx={styles.card}>
                <CardHeader
                    title="Server Overview"
                    sx={styles.cardheader}
                    slotProps={{
                        title: {
                            variant: 'h4',
                        },
                    }}
                    action={
                        <Stack direction="row" spacing={1}>
                            {/* Server Actions */}
                            <IconButton
                                aria-label="start"
                                sx={styles.iconbutton}
                                onClick={onStart}
                            >
                                <PlayArrowIcon />
                            </IconButton>
                            <IconButton
                                aria-label="stop"
                                sx={styles.iconbutton}
                                onClick={onStop}
                            >
                                <StopIcon />
                            </IconButton>
                            <IconButton
                                aria-label="restart"
                                sx={styles.iconbutton}
                                onClick={onRestart}
                            >
                                <RestartAltIcon />
                            </IconButton>
                            <IconButton
                                aria-label="reload"
                                sx={styles.iconbutton}
                                onClick={onReload}
                            >
                                <ReloadIcon />
                            </IconButton>

                            {/* Theme Toggle */}
                            <IconButton
                                aria-label="toggle-theme"
                                sx={styles.iconbutton}
                                onClick={() =>
                                    themeMode === 'dark'
                                        ? setThemeMode('light')
                                        : setThemeMode('dark')
                                }
                            >
                                {themeMode === 'dark' ? (
                                    <LightModeIcon />
                                ) : (
                                    <DarkModeIcon />
                                )}
                            </IconButton>
                        </Stack>
                    }
                />
                <CardContent sx={styles.cardcontent}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'max-content 1fr', // 1: breitester Inhalt, 2: Rest
                            columnGap: 1, // Abstand zwischen Spalten (theme spacing)
                            rowGap: 1, // Zeilenabstand
                            alignItems: 'center', // Labels/Controls vertikal angleichen
                            justifyItems: 'start',
                            width: '100%',
                        }}
                    >
                        <Typography variant="body1">Version:</Typography>
                        <Typography variant="body1">
                            {version || '—'}
                        </Typography>
                        <Typography variant="body1">DB file:</Typography>
                        <Typography
                            variant="body1"
                            noWrap
                            title={dbfile || '—'}
                        >
                            {dbfile || '—'}
                        </Typography>
                        <Typography variant="body1">Log level:</Typography>
                        <Box
                            sx={{
                                minWidth: 0 /* erlaubt dem Slider volle Breite */,
                                width: '100%',
                            }}
                        >
                            <LogLevelSlider
                                value={loglevel}
                                onChange={(ll) => onSetLoglevel(ll)}
                                disabled={busy || !loglevel}
                            />
                        </Box>

                        <Typography variant="body1">dbmaxmatches:</Typography>
                        <Typography variant="body1">
                            <TextField
                                type="number"
                                size="small"
                                xsx={{ width: '50%' }}
                                value={inputDbMaxMatches}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    // optional clamp >= 0
                                    if (Number(v) < 0) return;
                                    setInputDbMaxMatches(v);
                                }}
                                disabled={busy}
                                slotProps={{ input: { min: 0 } }}
                            />
                        </Typography>
                        <Typography variant="body1">dbpurgeage:</Typography>
                        <Typography variant="body1">
                            <TextField
                                type="number"
                                size="small"
                                xsx={{ width: '50%' }}
                                value={inputDbPurgeAge}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    // optional clamp >= 0
                                    if (Number(v) < 0) return;
                                    setInputDbPurgeAge(v);
                                }}
                                disabled={busy}
                                slotProps={{ input: { min: 0 } }}
                            />
                        </Typography>
                    </Box>

                    {error ? (
                        <Typography variant="h6" align="left">
                            {error}
                        </Typography>
                    ) : (
                        <>
                            <Typography
                                variant="body1"
                                align="left"
                                sx={styles.jailcount}
                            >
                                {list.length} Jail(s)
                            </Typography>
                            <Stack
                                direction="row"
                                flexWrap="wrap"
                                gap={1}
                                useFlexGap
                            >
                                {list.map((jail) => (
                                    <Chip
                                        key={jail}
                                        label={jail}
                                        sx={styles.chip}
                                        component="a"
                                        href={`#jail-${jail}`}
                                        clickable
                                    />
                                ))}
                            </Stack>
                        </>
                    )}
                </CardContent>
            </Card>
            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    severity={snack.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </>
    );
}
