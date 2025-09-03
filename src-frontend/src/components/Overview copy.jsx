import React from 'react';
import {
    Card,
    CardHeader,
    CardContent,
    Chip,
    Stack,
    Button,
    Typography,
    Divider,
    Grid,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Checkbox,
    FormControlLabel,
    Snackbar,
    Alert,
    Tooltip,
} from '@mui/material';

import StopIcon from '@mui/icons-material/Stop'; //stop
import PlayArrowIcon from '@mui/icons-material/PlayArrow'; //start
import RestartAltIcon from '@mui/icons-material/RestartAlt'; //restart
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt'; //reload
const StartIcon = PlayArrowIcon;
const RestartIcon = RestartAltIcon;
const ReloadIcon = SystemUpdateAltIcon;

const LOGLEVELS = [
    'CRITICAL',
    'ERROR',
    'WARNING',
    'NOTICE',
    'INFO',
    'DEBUG',
    'TRACEDEBUG',
    'HEAVYDEBUG',
];

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
}
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
    const [version, setVersion] = React.useState('');
    const [loglevel, setLoglevel] = React.useState('');
    const [dbfile, setDbfile] = React.useState('');
    const [dbMaxMatches, setDbMaxMatches] = React.useState('');
    const [dbPurgeAge, setDbPurgeAge] = React.useState('');

    // reload flags (server)
    const [srvReloadRestart, setSrvReloadRestart] = React.useState(false);
    const [srvReloadUnban, setSrvReloadUnban] = React.useState(false);
    const [srvReloadAll, setSrvReloadAll] = React.useState(false);

    // per-jail flags
    const [jailReloadRestart, setJailReloadRestart] = React.useState(false);
    const [jailReloadUnban, setJailReloadUnban] = React.useState(false);
    const [jailReloadIfExists, setJailReloadIfExists] = React.useState(false);
    const [jailRestartUnban, setJailRestartUnban] = React.useState(false);
    const [jailRestartIfExists, setJailRestartIfExists] = React.useState(false);

    // unban batch
    const [unbanIPs, setUnbanIPs] = React.useState('');

    // UI state
    const [busy, setBusy] = React.useState(false);
    const [snack, setSnack] = React.useState({
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
        cardcontent: { padding: '8px' },
        jailcount: { margin: '0px 8px 16px' },
        chip: {
            flex: '0 0 10px',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            backgroundColor: 'rgba(128, 128, 128, 0.2)',
        },
        sectionTitle: { margin: '16px 0 8px' },
        block: { marginTop: 10, marginBottom: 10 },
        buttonRow: { gap: 8, flexWrap: 'wrap' },
    };

    const showOk = (msg) => setSnack({ open: true, severity: 'success', msg });
    const showErr = (err) =>
        setSnack({
            open: true,
            severity: 'error',
            msg: typeof err === 'string' ? err : err.message || 'Error',
        });

    const loadInfo = React.useCallback(async () => {
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
            setVersion(v.version || '');
            setLoglevel(String(ll.loglevel || ''));
            setDbfile(dbf.dbfile || '');
            setDbMaxMatches(String(mm.dbmaxmatches || ''));
            setDbPurgeAge(String(pa.dbpurgeage || ''));
        } catch (e) {
            showErr(e);
        }
    }, []);

    React.useEffect(() => {
        loadInfo();
    }, [loadInfo]);

    // --- handlers for server controls ---
    const call = async (fn, successMsg) => {
        setBusy(true);
        try {
            const res = await fn();
            showOk(successMsg || res.result || 'OK');
            // refresh info after stateful ops
            await loadInfo();
        } catch (e) {
            showErr(e);
        } finally {
            setBusy(false);
        }
    };

    // server basic
    const onStart = () =>
        call(() => postJSON('/api/server/start'), 'Server started');
    const onRestart = () =>
        call(() => postJSON('/api/server/restart'), 'Server restarted');
    const onReload = () =>
        call(
            () =>
                postJSON('/api/server/reload', {
                    restart: srvReloadRestart,
                    unban: srvReloadUnban,
                    all: srvReloadAll,
                }),
            'Server reload issued'
        );
    const onStop = () =>
        call(() => postJSON('/api/server/stop'), 'Server stopped');

    // loglevel
    const onSetLoglevel = () =>
        call(
            () => postJSON('/api/loglevel', { level: loglevel }),
            `Log level set to ${loglevel}`
        );

    // db
    const onSetMaxMatches = () =>
        call(
            () =>
                postJSON('/api/db/maxmatches', {
                    value: Number(dbMaxMatches) || 0,
                }),
            'dbmaxmatches updated'
        );
    const onSetPurgeAge = () =>
        call(
            () =>
                postJSON('/api/db/purgeage', {
                    seconds: Number(dbPurgeAge) || 0,
                }),
            'dbpurgeage updated'
        );

    // unban
    const onUnbanAll = () =>
        call(() => postJSON('/api/unban/all'), 'All IPs unbanned');
    const onUnbanMany = () => {
        const ips = unbanIPs
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (!ips.length)
            return showErr('Please provide at least one IPv4 address.');
        return call(
            () => postJSON('/api/unban', { ips }),
            `Requested unban for ${ips.length} IPs`
        );
    };

    // per-jail actions
    const onJailReload = (jail) =>
        call(
            () =>
                postJSON(`/api/jail/${encodeURIComponent(jail)}/reload`, {
                    restart: jailReloadRestart,
                    unban: jailReloadUnban,
                    ifExists: jailReloadIfExists,
                }),
            `Reload issued for jail "${jail}"`
        );
    const onJailRestart = (jail) =>
        call(
            () =>
                postJSON(`/api/jail/${encodeURIComponent(jail)}/restart`, {
                    unban: jailRestartUnban,
                    ifExists: jailRestartIfExists,
                }),
            `Restart issued for jail "${jail}"`
        );

    return (
        <>
            <Card id={`overview`} sx={styles.card}>
                <CardHeader
                    title="Overview"
                    sx={styles.cardheader}
                    slotProps={{ title: { variant: 'h4' } }}
                    action={
                        <Button
                            onClick={() =>
                                themeMode === 'dark'
                                    ? setThemeMode('light')
                                    : setThemeMode('dark')
                            }
                            size="small"
                            variant="contained"
                            color="primary"
                            aria-label="toggle-theme"
                        >
                            Toggle Theme
                        </Button>
                    }
                />
                <CardContent sx={styles.cardcontent}>
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

                            {/* Summary row */}
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="body2">
                                        <b>Version:</b> {version || '—'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Typography variant="body2">
                                        <b>Log level:</b> {loglevel || '—'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Tooltip title={dbfile || ''}>
                                        <Typography variant="body2" noWrap>
                                            <b>DB file:</b> {dbfile || '—'}
                                        </Typography>
                                    </Tooltip>
                                </Grid>
                            </Grid>

                            {/* Jails list */}
                            <Stack
                                direction="row"
                                flexWrap="wrap"
                                gap={1}
                                useFlexGap
                                sx={{ mb: 2 }}
                            >
                                {list.map((jail) => (
                                    <Stack
                                        key={jail}
                                        direction="row"
                                        alignItems="center"
                                        spacing={1}
                                    >
                                        <Chip
                                            label={jail}
                                            sx={styles.chip}
                                            component="a"
                                            href={`#jail-${jail}`}
                                            clickable
                                        />
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => onJailReload(jail)}
                                            disabled={busy}
                                        >
                                            Reload
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => onJailRestart(jail)}
                                            disabled={busy}
                                        >
                                            Restart
                                        </Button>
                                    </Stack>
                                ))}
                            </Stack>

                            <Divider />

                            {/* Server controls */}
                            <Typography variant="h6" sx={styles.sectionTitle}>
                                Server Controls
                            </Typography>
                            <Stack direction="row" sx={styles.buttonRow}>
                                <Button
                                    variant="contained"
                                    onClick={onStart}
                                    disabled={busy}
                                >
                                    Start
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={onRestart}
                                    disabled={busy}
                                >
                                    Restart
                                </Button>
                                <Button
                                    variant="contained"
                                    color="warning"
                                    onClick={onReload}
                                    disabled={busy}
                                >
                                    Reload
                                </Button>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={onStop}
                                    disabled={busy}
                                >
                                    Stop
                                </Button>
                            </Stack>

                            <Stack
                                direction="row"
                                spacing={2}
                                sx={styles.block}
                            >
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={srvReloadRestart}
                                            onChange={(e) =>
                                                setSrvReloadRestart(
                                                    e.target.checked
                                                )
                                            }
                                        />
                                    }
                                    label="--restart"
                                />
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={srvReloadUnban}
                                            onChange={(e) =>
                                                setSrvReloadUnban(
                                                    e.target.checked
                                                )
                                            }
                                        />
                                    }
                                    label="--unban"
                                />
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={srvReloadAll}
                                            onChange={(e) =>
                                                setSrvReloadAll(
                                                    e.target.checked
                                                )
                                            }
                                        />
                                    }
                                    label="--all"
                                />
                            </Stack>

                            <Divider />

                            {/* Per-jail flags */}
                            <Typography variant="h6" sx={styles.sectionTitle}>
                                Per-Jail Options (for buttons next to each jail)
                            </Typography>
                            <Grid container spacing={2} sx={styles.block}>
                                <Grid item xs={12} md={6}>
                                    <Typography
                                        variant="subtitle2"
                                        gutterBottom
                                    >
                                        Reload flags
                                    </Typography>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={jailReloadRestart}
                                                onChange={(e) =>
                                                    setJailReloadRestart(
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                        }
                                        label="--restart"
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={jailReloadUnban}
                                                onChange={(e) =>
                                                    setJailReloadUnban(
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                        }
                                        label="--unban"
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={jailReloadIfExists}
                                                onChange={(e) =>
                                                    setJailReloadIfExists(
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                        }
                                        label="--if-exists"
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography
                                        variant="subtitle2"
                                        gutterBottom
                                    >
                                        Restart flags
                                    </Typography>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={jailRestartUnban}
                                                onChange={(e) =>
                                                    setJailRestartUnban(
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                        }
                                        label="--unban"
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={jailRestartIfExists}
                                                onChange={(e) =>
                                                    setJailRestartIfExists(
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                        }
                                        label="--if-exists"
                                    />
                                </Grid>
                            </Grid>

                            <Divider />

                            {/* Logging */}
                            <Typography variant="h6" sx={styles.sectionTitle}>
                                Logging
                            </Typography>
                            <Stack
                                direction="row"
                                spacing={2}
                                alignItems="center"
                                sx={styles.block}
                            >
                                <FormControl
                                    size="small"
                                    sx={{ minWidth: 200 }}
                                >
                                    <InputLabel id="loglevel-label">
                                        Log level
                                    </InputLabel>
                                    <Select
                                        labelId="loglevel-label"
                                        label="Log level"
                                        value={loglevel || ''}
                                        onChange={(e) =>
                                            setLoglevel(e.target.value)
                                        }
                                        MenuProps={{ disableScrollLock: true }}
                                    >
                                        {LOGLEVELS.map((lvl) => (
                                            <MenuItem key={lvl} value={lvl}>
                                                {lvl}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Button
                                    variant="outlined"
                                    onClick={onSetLoglevel}
                                    disabled={busy || !loglevel}
                                >
                                    Set Level
                                </Button>
                            </Stack>

                            <Divider />

                            {/* Database */}
                            <Typography variant="h6" sx={styles.sectionTitle}>
                                Database
                            </Typography>
                            <Grid container spacing={2} sx={styles.block}>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        label="dbmaxmatches"
                                        size="small"
                                        type="number"
                                        value={dbMaxMatches}
                                        onChange={(e) =>
                                            setDbMaxMatches(e.target.value)
                                        }
                                        fullWidth
                                    />
                                </Grid>
                                <Grid
                                    item
                                    xs={12}
                                    md={2}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Button
                                        variant="outlined"
                                        onClick={onSetMaxMatches}
                                        disabled={busy || dbMaxMatches === ''}
                                    >
                                        Apply
                                    </Button>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        label="dbpurgeage (seconds)"
                                        size="small"
                                        type="number"
                                        value={dbPurgeAge}
                                        onChange={(e) =>
                                            setDbPurgeAge(e.target.value)
                                        }
                                        fullWidth
                                    />
                                </Grid>
                                <Grid
                                    item
                                    xs={12}
                                    md={2}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Button
                                        variant="outlined"
                                        onClick={onSetPurgeAge}
                                        disabled={busy || dbPurgeAge === ''}
                                    >
                                        Apply
                                    </Button>
                                </Grid>
                            </Grid>

                            <Divider />

                            {/* Unban */}
                            <Typography variant="h6" sx={styles.sectionTitle}>
                                Unban
                            </Typography>
                            <Stack
                                direction="row"
                                spacing={2}
                                sx={styles.block}
                                alignItems="center"
                            >
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    onClick={onUnbanAll}
                                    disabled={busy}
                                >
                                    Unban All
                                </Button>
                                <TextField
                                    label="Unban IPs (comma or space separated IPv4)"
                                    size="small"
                                    value={unbanIPs}
                                    onChange={(e) =>
                                        setUnbanIPs(e.target.value)
                                    }
                                    sx={{ minWidth: 420 }}
                                />
                                <Button
                                    variant="outlined"
                                    onClick={onUnbanMany}
                                    disabled={busy}
                                >
                                    Unban Listed
                                </Button>
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
