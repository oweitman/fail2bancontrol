import { React, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    Card,
    Box,
    TextField,
    Typography,
    Accordion,
    AccordionDetails,
    AccordionSummary,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { postJSON } from './api';
export default function JailExtraInfo({ jailname, extrainfo }) {
    const [jailFindtime, setJailFindtime] = useState('');
    const [inputJailFindtime, setinputJailFindtime] = useState('');

    const [jailBantime, setJailBantime] = useState('');
    const [inputJailBantime, setinputJailBantime] = useState('');

    const [jailMaxretry, setJailMaxretry] = useState('');
    const [inputJailMaxretry, setinputJailMaxretry] = useState('');

    const [jailMaxmatches, setJailMaxmatches] = useState('');
    const [inputJailMaxmatches, setinputJailMaxmatches] = useState('');

    const [jailMaxlines, setJailMaxlines] = useState('');
    const [inputJailMaxlines, setinputJailMaxlines] = useState('');

    const styles = {
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
        chip: {
            flex: '0 0 140px',
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
        textfirst: {
            gridColumn: '1 / -1',
            minWidth: 0,
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            paddingTop: '24px',
        },
        text: {
            gridColumn: '1 / -1',
            minWidth: 0,
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
        },
    };
    useEffect(() => {
        setinputJailBantime(extrainfo?.bantime || '');
        setJailBantime(extrainfo?.bantime || '');

        setinputJailFindtime(extrainfo?.findtime || '');
        setJailFindtime(extrainfo?.findtime || '');

        setinputJailMaxlines(extrainfo?.maxlines || '');
        setJailMaxlines(extrainfo?.maxlines || '');

        setinputJailMaxmatches(extrainfo?.maxmatches || '');
        setJailMaxmatches(extrainfo?.maxmatches || '');

        setinputJailMaxretry(extrainfo?.maxretry || '');
        setJailMaxretry(extrainfo?.maxretry || '');
    }, [jailname, extrainfo]);

    const onSetJailBantime = useCallback((jailname, val) =>
        postJSON(`/api/jail/${jailname}/bantime`, {
            value: Number(val) || 0,
        })
    );
    useEffect(() => {
        if (inputJailBantime === '' || inputJailBantime === jailBantime) return;
        const t = setTimeout(() => {
            const n = Number(inputJailBantime);
            if (!Number.isFinite(n) || n < 0) return;
            onSetJailBantime(jailname, n);
            setJailBantime(inputJailBantime);
        }, 1000);
        return () => clearTimeout(t);
    }, [inputJailBantime, jailBantime, onSetJailBantime]);

    const onSetJailFindtime = useCallback((jailname, val) =>
        postJSON(`/api/jail/${jailname}/findtime`, {
            value: Number(val) || 0,
        })
    );
    useEffect(() => {
        if (inputJailFindtime === '' || inputJailFindtime === jailFindtime)
            return;
        const t = setTimeout(() => {
            const n = Number(inputJailFindtime);
            if (!Number.isFinite(n) || n < 0) return;
            onSetJailFindtime(jailname, n);
            setJailFindtime(inputJailFindtime);
        }, 1000);
        return () => clearTimeout(t);
    }, [inputJailFindtime, jailFindtime, onSetJailFindtime]);

    const onSetJailMaxretry = useCallback((jailname, val) =>
        postJSON(`/api/jail/${jailname}/maxretry`, {
            value: Number(val) || 0,
        })
    );
    useEffect(() => {
        if (inputJailMaxretry === '' || inputJailMaxretry === jailMaxretry)
            return;
        const t = setTimeout(() => {
            const n = Number(inputJailMaxretry);
            if (!Number.isFinite(n) || n < 0) return;
            onSetJailMaxretry(jailname, n);
            setJailMaxretry(inputJailMaxretry);
        }, 1000);
        return () => clearTimeout(t);
    }, [inputJailMaxretry, jailMaxretry, onSetJailMaxretry]);

    const onSetJailMaxmatches = useCallback((jailname, val) =>
        postJSON(`/api/jail/${jailname}/maxmatches`, {
            value: Number(val) || 0,
        })
    );
    useEffect(() => {
        if (
            inputJailMaxmatches === '' ||
            inputJailMaxmatches === jailMaxmatches
        )
            return;
        const t = setTimeout(() => {
            const n = Number(inputJailMaxmatches);
            if (!Number.isFinite(n) || n < 0) return;
            onSetJailMaxmatches(jailname, n);
            setJailMaxmatches(inputJailMaxmatches);
        }, 1000);
        return () => clearTimeout(t);
    }, [inputJailMaxmatches, jailMaxmatches, onSetJailMaxmatches]);

    const onSetJailMaxlines = useCallback((jailname, val) =>
        postJSON(`/api/jail/${jailname}/maxlines`, {
            value: Number(val) || 0,
        })
    );
    useEffect(() => {
        if (inputJailMaxlines === '' || inputJailMaxlines === jailMaxlines)
            return;
        const t = setTimeout(() => {
            const n = Number(inputJailMaxlines);
            if (!Number.isFinite(n) || n < 0) return;
            onSetJailMaxlines(jailname, n);
            setJailMaxlines(inputJailMaxlines);
        }, 1000);
        return () => clearTimeout(t);
    }, [inputJailMaxlines, jailMaxlines, onSetJailMaxlines]);

    return (
        <Card sx={styles.card}>
            <Accordion>
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={styles.iconbutton} />}
                    aria-controls="panel1-content"
                    id="panel1-header"
                >
                    <Typography component="span">Extra Info</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'max-content 1fr', // 1: breitester Inhalt, 2: Rest
                            columnGap: 1, // Abstand zwischen Spalten (theme spacing)
                            rowGap: 0, // Zeilenabstand
                            alignItems: 'center', // Labels/Controls vertikal angleichen
                            justifyItems: 'start',
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px',
                        }}
                    >
                        <Typography variant="body1">findtime:</Typography>
                        <TextField
                            type="number"
                            size="small"
                            color="primary"
                            sx={styles.textfield}
                            value={inputJailFindtime}
                            onChange={(e) => {
                                const v = e.target.value;
                                // optional clamp >= 0
                                if (Number(v) < 1) return;
                                setinputJailFindtime(v);
                            }}
                            slotProps={{ input: { min: 1 } }}
                        />
                        <Typography variant="body1">bantime:</Typography>
                        <TextField
                            type="number"
                            size="small"
                            color="primary"
                            sx={styles.textfield}
                            value={inputJailBantime}
                            onChange={(e) => {
                                const v = e.target.value;
                                // optional clamp >= 0
                                if (Number(v) < 1) return;
                                setinputJailBantime(v);
                            }}
                            slotProps={{ input: { min: 1 } }}
                        />
                        <Typography variant="body1">maxretry:</Typography>
                        <TextField
                            type="number"
                            size="small"
                            color="primary"
                            sx={styles.textfield}
                            value={inputJailMaxretry}
                            onChange={(e) => {
                                const v = e.target.value;
                                // optional clamp >= 0
                                if (Number(v) < 1) return;
                                setinputJailMaxretry(v);
                            }}
                            slotProps={{ input: { min: 1 } }}
                        />
                        <Typography variant="body1">maxmatches:</Typography>
                        <TextField
                            type="number"
                            size="small"
                            color="primary"
                            sx={styles.textfield}
                            value={inputJailMaxmatches}
                            onChange={(e) => {
                                const v = e.target.value;
                                // optional clamp >= 0
                                if (Number(v) < 1) return;
                                setinputJailMaxmatches(v);
                            }}
                            slotProps={{ input: { min: 1 } }}
                        />
                        <Typography variant="body1">maxlines:</Typography>
                        <TextField
                            type="number"
                            size="small"
                            color="primary"
                            sx={styles.textfield}
                            value={inputJailMaxlines}
                            onChange={(e) => {
                                const v = e.target.value;
                                // optional clamp >= 0
                                if (Number(v) < 1) return;
                                setinputJailMaxlines(v);
                            }}
                            slotProps={{ input: { min: 1 } }}
                        />
                        <Typography variant="body1" sx={styles.textfirst}>
                            Remember:
                        </Typography>
                        <Typography variant="body1" sx={styles.text}>
                            These changes are only temporary.
                        </Typography>
                        <Typography variant="body1" sx={styles.text}>
                            After restarting the fail2ban service, the values
                            configured in the jails will be restored.
                        </Typography>
                        <Typography variant="body1" sx={styles.text}>
                            For permanent changes, please adjust the jail
                            configuration.
                        </Typography>
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Card>
    );
}
JailExtraInfo.propTypes = {
    jailname: PropTypes.string.isRequired,
    extrainfo: PropTypes.object.isRequired,
};
