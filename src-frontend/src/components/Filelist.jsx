import { useState, useEffect, useCallback } from 'react';
import {
    Card,
    CardHeader,
    CardContent,
    Chip,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    FormControlLabel,
    Switch,
    TextField,
} from '@mui/material';
import { getFile } from './api';

const LS_KEYS = {
    tailLines: 'f2b.filelist.tailLines',
    pollIntervalSec: 'f2b.filelist.pollIntervalSec',
    tailMode: 'f2b.filelist.tailMode',
};

function readNumberLS(key, fallback, min) {
    try {
        const v = Number(localStorage.getItem(key));
        if (!Number.isFinite(v)) return fallback;
        if (typeof min === 'number' && v < min) return fallback;
        return v;
    } catch {
        return fallback;
    }
}

function readBoolLS(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        if (v === null) return fallback;
        return v === 'true' || v === '1';
    } catch {
        return fallback;
    }
}

export default function Filelist({ filelist }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogTitle, setDialogTitle] = useState('');
    const [fileText, setFileText] = useState('');
    const [currentFilePath, setCurrentFilePath] = useState(null);

    const [tailMode, setTailMode] = useState(() =>
        readBoolLS(LS_KEYS.tailMode, true)
    );
    const [tailLines, setTailLines] = useState(() =>
        readNumberLS(LS_KEYS.tailLines, 20, 1)
    );
    const [pollIntervalSec, setPollIntervalSec] = useState(() =>
        readNumberLS(LS_KEYS.pollIntervalSec, 5, 1)
    );

    useEffect(() => {
        try {
            localStorage.setItem(LS_KEYS.tailMode, String(tailMode));
        } catch (e) {
            console.log(e);
        }
    }, [tailMode]);

    useEffect(() => {
        try {
            localStorage.setItem(LS_KEYS.tailLines, String(tailLines));
        } catch (e) {
            console.log(e);
        }
    }, [tailLines]);

    useEffect(() => {
        try {
            localStorage.setItem(
                LS_KEYS.pollIntervalSec,
                String(pollIntervalSec)
            );
        } catch (e) {
            console.log(e);
        }
    }, [pollIntervalSec]);

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
            '& .MuiInputLabel-root': {
                color: 'var(--text-color)',
            },
            '& .MuiInputLabel-root.Mui-focused': {
                color: 'var(--accent-color)',
            },
            '& .MuiInputLabel-root.Mui-disabled': {
                color: (theme) => theme.palette.text.disabled,
            },
            '& .MuiOutlinedInput-input': {
                color: 'var(--text-color)',
            },
            '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--border-color)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--accent-color)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--accent-color)',
            },
        },
    };

    const fetchFileData = useCallback(
        async (path) => {
            const computeLinesParam = () => {
                if (!tailMode) return 0;
                const n = Number(tailLines) || 0;
                return n > 0 ? -n : -20;
            };
            try {
                const linesParam = computeLinesParam();
                const filedata = await getFile(path, linesParam);
                setFileText(
                    Array.isArray(filedata.lines)
                        ? filedata.lines.join('\n')
                        : filedata.content || ''
                );
            } catch (error) {
                console.error(error);
            }
        },
        [tailMode, tailLines, setFileText]
    );

    const handleClick = async (file) => {
        setDialogTitle(file.path);
        setCurrentFilePath(file.path);
        await fetchFileData(file.path);
        setDialogOpen(true);
    };

    useEffect(() => {
        if (!dialogOpen || !currentFilePath) return;

        const id = setInterval(() => {
            fetchFileData(currentFilePath);
        }, Math.max(1, Number(pollIntervalSec) || 5) * 1000);

        return () => clearInterval(id);
    }, [
        dialogOpen,
        currentFilePath,
        pollIntervalSec,
        tailMode,
        tailLines,
        fetchFileData,
    ]);

    useEffect(() => {
        if (dialogOpen && currentFilePath) {
            fetchFileData(currentFilePath);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tailMode, tailLines]);

    return (
        <>
            <Card sx={styles.card}>
                <CardHeader
                    title="Filelist"
                    sx={styles.cardheader}
                    slotProps={{ title: { variant: 'h6' } }}
                />
                <CardContent sx={styles.cardcontent}>
                    <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                        {filelist.map((file) => (
                            <Chip
                                key={file.path}
                                label={file.path}
                                sx={styles.chip}
                                onClick={
                                    file.exists
                                        ? () => handleClick(file)
                                        : undefined
                                }
                                variant="outlined"
                                color={file.exists ? 'default' : 'warning'}
                            />
                        ))}
                    </Stack>
                </CardContent>
            </Card>

            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                fullWidth
                maxWidth={false}
                slotProps={{
                    paper: {
                        sx: {
                            width: '80vw',
                            height: '80vh',
                            resize: 'both',
                            overflow: 'auto',
                        },
                    },
                }}
            >
                <DialogTitle sx={{ pr: 2, py: 1 }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <Box component="span">{dialogTitle}</Box>

                        <Stack direction="row" spacing={2} alignItems="center">
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={tailMode}
                                        onChange={(e) =>
                                            setTailMode(e.target.checked)
                                        }
                                        color="primary"
                                    />
                                }
                                label={
                                    tailMode
                                        ? 'Tail (last lines)'
                                        : 'Entire file'
                                }
                            />
                            <TextField
                                label="Lines"
                                type="number"
                                size="small"
                                value={tailLines}
                                onChange={(e) =>
                                    setTailLines(
                                        Math.max(
                                            1,
                                            Number(e.target.value) || 20
                                        )
                                    )
                                }
                                disabled={!tailMode}
                                sx={styles.textfield}
                                slotProps={{
                                    input: { min: 1 },
                                }}
                            />
                            <TextField
                                label="Interval (s)"
                                type="number"
                                size="small"
                                value={pollIntervalSec}
                                onChange={(e) =>
                                    setPollIntervalSec(
                                        Math.max(1, Number(e.target.value) || 5)
                                    )
                                }
                                sx={styles.textfield}
                                slotProps={{
                                    input: { min: 1 },
                                }}
                            />
                        </Stack>
                    </Stack>
                </DialogTitle>

                <DialogContent
                    dividers
                    sx={{
                        p: 0,
                        m: 0,
                        overflow: 'auto',
                        backgroundColor: '#111',
                    }}
                >
                    <Box
                        component="pre"
                        sx={{
                            m: 0,
                            p: 2,
                            fontFamily: 'monospace',
                            fontSize: '0.9rem',
                            whiteSpace: 'pre',
                            overflow: 'auto',
                            color: '#fff',
                        }}
                    >
                        {fileText}
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
