import { useEffect, useState, useCallback } from 'react';
import {
    Card,
    CardHeader,
    CardContent,
    Stack,
    Typography,
    TextField,
    Button,
    IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

import JailValues from './JailValues.jsx';
import BannedIPs from './BannedIPs.jsx';
import {
    getJailStatus,
    banIP /* getGlobalStatus, getJailStatus, , unbanIP */,
} from './api';

export default function Jail({ name }) {
    const [ip, setIp] = useState('');
    const [error, setError] = useState('');
    const [jail, setJail] = useState(null);

    const refreshStatus = useCallback(() => {
        getJailStatus(name).then(setJail).catch(console.error);
    }, [name]);
    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

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
        refreshbutton: {
            color: 'var(--text-color)',
        },
        textfield: {
            color: 'var(--text-color)',
        },
    };

    const ipv4Regex =
        /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

    const handleBan = async () => {
        if (!ipv4Regex.test(ip)) {
            setError('Please enter a valid IP.');
            return;
        }
        setError('');

        try {
            await banIP(name, ip);

            // Status direkt neu laden
            refreshStatus();

            // Eingabe leeren
            setIp('');
        } catch (err) {
            setError(err.message || 'Network error');
        }
    };

    return (
        <Card id={`jail-${name}`} sx={styles.card}>
            <CardHeader
                title={name}
                sx={{
                    ...styles.cardheader,
                    '& a': {
                        color: 'inherit', // gleiche Farbe wie normaler Text
                        textDecoration: 'none', // kein Unterstrich
                    },
                    '& a:hover': {
                        textDecoration: 'underline', // optional bei Hover
                    },
                }}
                slotProps={{
                    title: {
                        variant: 'h4',
                        component: 'a',
                        href: '#overview',
                    },
                }}
                action={
                    <IconButton
                        onClick={() => refreshStatus()}
                        aria-label="refresh"
                        color="var(--text-color)"
                        sx={styles.refreshbutton}
                    >
                        <RefreshIcon />
                    </IconButton>
                }
            />
            <CardContent sx={styles.cardcontent}>
                <Stack direction="column" spacing={2}>
                    <Stack direction="row" spacing={2}>
                        <JailValues
                            type="Banned"
                            values={{
                                total: jail?.actions?.totalBanned,
                                current: jail?.actions?.currentlyBanned,
                            }}
                        />
                        <JailValues
                            type="Failed"
                            values={{
                                total: jail?.filter?.totalFailed,
                                current: jail?.filter?.currentlyFailed,
                            }}
                        />
                    </Stack>
                    <Card>
                        <CardContent>
                            <Typography variant="body1" align="left">
                                Logfile: {jail?.filter?.fileList.join(', ')}
                            </Typography>
                        </CardContent>
                    </Card>
                    <BannedIPs
                        refreshStatus={refreshStatus}
                        name={name}
                        ips={jail?.actions?.bannedIPList || []}
                    />
                    <Stack direction="row" spacing={1}>
                        <TextField
                            label="IP to Ban"
                            variant="outlined"
                            fullWidth
                            value={ip}
                            onChange={(e) => setIp(e.target.value)}
                            error={!!error}
                            helperText={error}
                            size="small"
                            sx={{
                                '& .MuiInputLabel-root': {
                                    color: 'var(--text-color)', // normale Label-Farbe
                                },
                                '& .MuiInputLabel-root.Mui-focused': {
                                    color: 'var(--accent-color)', // Farbe, wenn fokussiert
                                },
                            }}
                        />
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleBan}
                        >
                            Ban
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}
