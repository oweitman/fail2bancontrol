import { React, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Card,
    CardHeader,
    CardContent,
    Chip,
    Stack,
    IconButton,
    Typography,
    TextField,
    Snackbar,
    Alert,
    Tooltip,
} from '@mui/material';

import StopIcon from '@mui/icons-material/Stop'; //stop
import PlayArrowIcon from '@mui/icons-material/PlayArrow'; //start
import RestartAltIcon from '@mui/icons-material/RestartAlt'; //restart
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt'; //reload
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

import BannedIPs from './BannedIPs.jsx';
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
export default function Overview({
    list,
    themeMode,
    setThemeMode,
    error,
    doOverviewRefresh,
    overviewRefresh,
    setJailRefresh,
}) {
    const [version, setVersion] = useState('');
    const [loglevel, setLoglevel] = useState('');
    const [dbfile, setDbfile] = useState('');
    const [dbMaxMatches, setDbMaxMatches] = useState('');
    const [inputDbMaxMatches, setInputDbMaxMatches] = useState('');
    const [dbPurgeAge, setDbPurgeAge] = useState('');
    const [inputDbPurgeAge, setInputDbPurgeAge] = useState('');
    const [banned, setBanned] = useState([]);
    const [busy, setBusy] = useState(false);
    const [snack, setSnack] = useState({
        open: false,
        severity: 'success',
        msg: '',
    });

    const styles = {
        cardoverview: {
            minWidth: '900px',
            margin: '15px 0px',
            padding: '12px 15px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        },
        cardheaderoverview: {
            textAlign: 'left',
            padding: '8px',
            color: 'var(--text-color)',
        },
        cardcontentoverview: {
            padding: '8px',
        },
        card: {
            margin: '0px 0px',
            padding: '0px 0px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        },
        cardheader: {
            textAlign: 'left',
            padding: '8px',
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
            padding: '8px 8px',
            transition: 'transform 0.2s ease-in-out',
            '&:hover': {
                transform: 'scale(1.2)',
            },
            color: 'var(--text-color)',
        },
        textfield: {
            '& .MuiOutlinedInput-root': {
                '& fieldset': {
                    borderColor: 'divider', // <- normal
                },
                'x&:hover fieldset': {
                    borderColor: 'divider', // <- hover
                },
                'x&.Mui-focused fieldset': {
                    borderColor: 'divider', // <- focus
                },
            },
        },
    };

    const loadInfo = useCallback(async () => {
        try {
            // optional: add ?ttl=300 to smooth bursts when multiple components call at once
            const o = await fetchJSON('/api/overview?ttl=300');

            // o.version e.g. "Fail2Ban v1.0.2"
            setVersion(o.version.split('\n')[1] || '');

            // these come already normalized (second line extracted on server)
            setLoglevel(String(o.loglevel ?? ''));

            const db = o.db || {};
            setDbfile(db.file || '');

            const mmVal = String(db.maxmatches ?? '');
            setDbMaxMatches(mmVal);
            setInputDbMaxMatches(mmVal);

            const paVal = String(db.purgeage ?? '');
            setDbPurgeAge(paVal);
            setInputDbPurgeAge(paVal);

            setBanned(o.banned?.ips ?? []);
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

    useEffect(() => {
        loadInfo();
        doOverviewRefresh(false);
    }, [overviewRefresh]);

    const showOk = (msg) => setSnack({ open: true, severity: 'success', msg });
    const showErr = (err) =>
        setSnack({
            open: true,
            severity: 'error',
            msg: typeof err === 'string' ? err : err.message || 'Error',
        });

    async function fetchJSON(url) {
        const res = await fetch(url);
        let errorDetail = '';

        if (!res.ok) {
            try {
                const errJson = await res.json();
                errorDetail = errJson?.error || JSON.stringify(errJson);
            } catch {
                errorDetail = await res.text().catch(() => '');
            }
            throw new Error(
                `Error ${res.status} ${res.statusText}${
                    errorDetail ? `: ${errorDetail}` : ''
                }`
            );
        }

        return res.json();
    }
    return (
        <>
            <Card id={`overview`} sx={styles.cardoverview}>
                <CardHeader
                    title="Server Overview"
                    sx={styles.cardheaderoverview}
                    slotProps={{
                        title: {
                            variant: 'h4',
                        },
                    }}
                    action={
                        <Stack direction="row" spacing={1}>
                            {/* Server Actions */}
                            <Tooltip title="Start fail2ban">
                                <IconButton
                                    aria-label="start"
                                    sx={styles.iconbutton}
                                    onClick={onStart}
                                >
                                    <StartIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Stop fail2ban">
                                <IconButton
                                    aria-label="stop"
                                    sx={styles.iconbutton}
                                    onClick={onStop}
                                >
                                    <StopIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Restart fail2ban">
                                <IconButton
                                    aria-label="restart"
                                    sx={styles.iconbutton}
                                    onClick={onRestart}
                                >
                                    <RestartIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Reload fail2ban">
                                <IconButton
                                    aria-label="reload"
                                    sx={styles.iconbutton}
                                    onClick={onReload}
                                >
                                    <ReloadIcon />
                                </IconButton>
                            </Tooltip>

                            {/* Theme Toggle */}
                            <Tooltip title="Theme toggle">
                                <IconButton
                                    xaria-label="toggle-theme"
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
                            </Tooltip>
                        </Stack>
                    }
                />
                <CardContent sx={styles.cardcontentoverview}>
                    <Card sx={styles.card}>
                        <CardHeader
                            title="Info & Settings"
                            sx={styles.cardheader}
                            slotProps={{
                                title: {
                                    variant: 'h6',
                                },
                            }}
                        />
                        <CardContent sx={styles.cardcontent}>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'max-content 1fr', // 1: breitester Inhalt, 2: Rest
                                    columnGap: 1, // Abstand zwischen Spalten (theme spacing)
                                    rowGap: 0, // Zeilenabstand
                                    alignItems: 'center', // Labels/Controls vertikal angleichen
                                    justifyItems: 'start',
                                    width: '100%',
                                }}
                            >
                                <Typography variant="body1">
                                    Version:
                                </Typography>
                                <Typography variant="body1">
                                    {version || '—'}
                                </Typography>
                                <Typography variant="body1">
                                    DB file:
                                </Typography>
                                <Typography
                                    variant="body1"
                                    noWrap
                                    title={dbfile || '—'}
                                >
                                    {dbfile || '—'}
                                </Typography>
                                <Typography variant="body1">
                                    Log level:
                                </Typography>
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

                                <Typography variant="body1">
                                    dbmaxmatches:
                                </Typography>
                                <Box>
                                    <TextField
                                        type="number"
                                        size="small"
                                        color="primary"
                                        sx={styles.textfield}
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
                                </Box>
                                <Typography variant="body1">
                                    dbpurgeage:
                                </Typography>
                                <Box>
                                    <TextField
                                        type="number"
                                        size="small"
                                        color="primary"
                                        sx={styles.textfield}
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
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                    <Card sx={styles.card}>
                        <CardHeader
                            title={list.length + ' Jail(s)'}
                            sx={styles.cardheader}
                            slotProps={{
                                title: {
                                    variant: 'h6',
                                },
                            }}
                        />
                        <CardContent sx={styles.cardcontent}>
                            {error ? (
                                <Typography variant="h6" align="left">
                                    {error}
                                </Typography>
                            ) : (
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
                            )}
                        </CardContent>
                    </Card>

                    <BannedIPs
                        refreshStatus={loadInfo}
                        name=""
                        ips={banned || []}
                        setJailRefresh={setJailRefresh}
                    />
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
Overview.propTypes = {
    list: PropTypes.object.isRequired,
    themeMode: PropTypes.string.isRequired,
    setThemeMode: PropTypes.func.isRequired,
    error: PropTypes.string,
    doOverviewRefresh: PropTypes.func.isRequired,
    overviewRefresh: PropTypes.bool.isRequired,
    setJailRefresh: PropTypes.func.isRequired,
};
