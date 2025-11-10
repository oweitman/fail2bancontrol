import { React, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
    Card,
    CardHeader,
    CardContent,
    Stack,
    TextField,
    Button,
    IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

import JailValues from './JailValues.jsx';
import BannedIPs from './BannedIPs.jsx';
import Filelist from './Filelist.jsx';
import { getJailStatus, banIP } from './api';
import JailExtraInfo from './JailExtrainfo.jsx';

export default function Jail({
    jailname,
    doOverviewRefresh,
    setJailRefresh,
    jailRefresh,
}) {
    const [ip, setIp] = useState('');
    const [error, setError] = useState('');
    const [jail, setJail] = useState(null);

    const refreshStatus = useCallback(() => {
        getJailStatus(jailname).then(setJail).catch(console.error);
    }, [jailname]);

    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    useEffect(() => {
        refreshStatus();
        setJailRefresh(false);
    }, [jailRefresh]);

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
            '& .MuiInputLabel-root': {
                color: 'var(--text-color)',
            },
            '& .MuiInputLabel-root.Mui-focused': {
                color: 'var(--accent-color)',
            },
        },
        chip: {
            flex: '0 0 140px',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            backgroundColor: 'rgba(128, 128, 128, 0.2)',
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
            await banIP(jailname, ip);
            refreshStatus();
            setIp('');
        } catch (err) {
            setError(err.message || 'Network error');
        }
    };

    return (
        <Card id={`jail-${jailname}`} sx={styles.card}>
            <CardHeader
                title={jailname}
                sx={{
                    ...styles.cardheader,
                    '& a': {
                        color: 'inherit',
                        textDecoration: 'none',
                    },
                    '& a:hover': {
                        textDecoration: 'underline',
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
                    <Filelist filelist={jail?.filter?.fileList || []} />
                    <BannedIPs
                        refreshStatus={refreshStatus}
                        name={jailname}
                        ips={jail?.actions?.bannedIPList || []}
                        doOverviewRefresh={doOverviewRefresh}
                    />
                    <Stack direction="row" spacing={1}>
                        <TextField
                            label="Enter IP to Ban"
                            variant="outlined"
                            fullWidth
                            value={ip}
                            onChange={(e) => setIp(e.target.value)}
                            error={!!error}
                            helperText={error}
                            size="small"
                            sx={styles.textfield}
                        />
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleBan}
                        >
                            Ban
                        </Button>
                    </Stack>
                    <JailExtraInfo
                        refreshStatus={refreshStatus}
                        jailname={jailname}
                        extrainfo={jail?.extra}
                        doOverviewRefresh={doOverviewRefresh}
                        setJailRefresh={setJailRefresh}
                    />
                </Stack>
            </CardContent>
        </Card>
    );
}
Jail.propTypes = {
    jailname: PropTypes.string.isRequired,
    doOverviewRefresh: PropTypes.func.isRequired,
    setJailRefresh: PropTypes.func.isRequired,
    jailRefresh: PropTypes.bool.isRequired,
};
