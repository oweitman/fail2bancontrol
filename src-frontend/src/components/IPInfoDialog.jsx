import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, Link, Stack, Typography,
} from '@mui/material';
import { getIPInfo } from './api';

const fields = [
    ['org', 'Organization'], ['asn', 'ASN'], ['as_name', 'ASN name'],
    ['isp', 'ISP'], ['country_name', 'Country'], ['region', 'Region'],
    ['district', 'District'], ['city', 'City'], ['postal', 'Postal code'],
    ['loc', 'Approximate coordinates'], ['timezone', 'Time zone'],
    ['connection_type', 'Connection type'], ['user_type', 'Network usage'],
];

export default function IPInfoDialog({ ip, onClose }) {
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(true);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setBusy(true);
        setError('');
        getIPInfo(ip, attempt > 0, controller.signal)
            .then(setResult)
            .catch((err) => {
                if (!controller.signal.aborted) setError(err.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setBusy(false);
            });
        return () => controller.abort();
    }, [ip, attempt]);

    const timestamp = result && new Date(result.queriedAt);
    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="ip-info-title">
            <DialogTitle id="ip-info-title">IP information: {ip}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2">
                        Lookups are sent to IP Info by the server. Location data is approximate
                        and may be incomplete or outdated.
                    </Typography>
                    {busy && <Box role="status" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <CircularProgress size={20} /> Looking up IP information…
                    </Box>}
                    {error && <Alert severity="error">{error}{result && ' Previously retrieved data is shown below.'}</Alert>}
                    {result && <>
                        <Typography variant="body2">
                            Queried at: <time dateTime={result.queriedAt} title={result.queriedAt}>
                                {new Intl.DateTimeFormat(undefined, {
                                    year: 'numeric', month: '2-digit', day: '2-digit',
                                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                                    timeZoneName: 'short',
                                }).format(timestamp)}
                            </time>
                            {' · '}{result.cached ? 'From server cache' : 'Fresh lookup'}
                        </Typography>
                        <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1fr) 2fr', gap: 1, m: 0 }}>
                            {fields.map(([key, label]) => (
                                <Box key={key} sx={{ display: 'contents' }}>
                                    <Typography component="dt" variant="body2">{label}</Typography>
                                    <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                                        {result.data[key] == null ? 'Unavailable' : key === 'asn' ? `AS${result.data[key]}` : String(result.data[key])}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                        <Link href={result.source} target="_blank" rel="noopener noreferrer">Source: ip-info.com</Link>
                    </>}
                    <Typography variant="caption">Successful lookups are cached on the server for 24 hours.</Typography>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setAttempt((value) => value + 1)} disabled={busy}>
                    Query again
                </Button>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
IPInfoDialog.propTypes = {
    ip: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
};
