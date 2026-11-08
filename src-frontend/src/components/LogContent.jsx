import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
    Alert, Box, Checkbox, FormControlLabel, IconButton, Stack, TextField,
    Tooltip, Typography,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

export default function LogContent({ text }) {
    const [query, setQuery] = useState('');
    const [regex, setRegex] = useState(false);
    const [matchCase, setMatchCase] = useState(false);
    const [filter, setFilter] = useState(false);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const contentRef = useRef(null);

    useEffect(() => {
        if (!query) {
            setResult(null);
            setBusy(false);
            return;
        }
        // A separate worker keeps expensive regex patterns away from the UI thread.
        let worker;
        let timeout;
        setBusy(true);
        const debounce = setTimeout(() => {
            try {
                worker = new Worker(new URL('../utils/logSearch.worker.js', import.meta.url), { type: 'module' });
                worker.onmessage = ({ data }) => {
                    clearTimeout(timeout);
                    setResult({ ...data, text, query, regex, matchCase });
                    setBusy(false);
                    worker.terminate();
                };
                const fail = (message) => {
                    clearTimeout(timeout);
                    worker?.terminate();
                    setResult({ error: message, text, query, regex, matchCase });
                    setBusy(false);
                };
                worker.onerror = (event) => {
                    event.preventDefault();
                    fail('Search failed. Please try another pattern.');
                };
                timeout = setTimeout(() => fail('Search took too long. Please simplify the pattern.'), 2000);
                worker.postMessage({ text, query, regex, matchCase });
            } catch {
                setResult({ error: 'Search is unavailable in this browser.', text, query, regex, matchCase });
                setBusy(false);
            }
        }, 150);
        return () => {
            clearTimeout(debounce);
            clearTimeout(timeout);
            worker?.terminate();
        };
    }, [text, query, regex, matchCase]);

    const currentResult = result?.text === text && result?.query === query
        && result?.regex === regex && result?.matchCase === matchCase ? result : null;
    const rows = useMemo(() => currentResult?.rows ?? (text === '' ? [] : text.split('\n').map(
        (line, index) => ({ text: line, index, matches: [] })
    )), [currentResult, text]);
    const matchingRows = useMemo(() => rows.filter((row) => row.matches.length), [rows]);
    const visibleRows = filter && query && currentResult?.rows ? matchingRows : rows;
    const selectedIndex = matchingRows.length ? activeIndex % matchingRows.length : 0;
    const selectedLine = matchingRows[selectedIndex]?.index;
    const ready = Boolean(query && currentResult?.rows);
    const error = currentResult?.error;

    useEffect(() => {
        if (selectedLine !== undefined) {
            contentRef.current?.querySelector(`[data-line="${selectedLine}"]`)
                ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        }
    }, [selectedLine, filter]);

    const navigate = (direction) => {
        if (matchingRows.length) setActiveIndex((selectedIndex + direction + matchingRows.length) % matchingRows.length);
    };
    const changeOption = (setter, value) => {
        setter(value);
        setActiveIndex(0);
    };

    return (
        <>
            <Stack spacing={1} sx={{ px: 2, py: 1, flexShrink: 0 }}>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <TextField
                        label="Search log"
                        placeholder={regex ? 'Regular expression' : 'Text to find'}
                        size="small"
                        value={query}
                        onChange={(event) => changeOption(setQuery, event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                navigate(event.shiftKey ? -1 : 1);
                            }
                        }}
                        error={Boolean(error)}
                        sx={{ flex: '1 1 240px' }}
                    />
                    <Tooltip title="Previous matching line (Shift+Enter)">
                        <span><IconButton sx={{ color: 'text.primary' }} aria-label="Previous matching line" disabled={!ready || !matchingRows.length} onClick={() => navigate(-1)}>
                            <ArrowUpwardIcon />
                        </IconButton></span>
                    </Tooltip>
                    <Tooltip title="Next matching line (Enter)">
                        <span><IconButton sx={{ color: 'text.primary' }} aria-label="Next matching line" disabled={!ready || !matchingRows.length} onClick={() => navigate(1)}>
                            <ArrowDownwardIcon />
                        </IconButton></span>
                    </Tooltip>
                    <Typography variant="body2" role="status" sx={{ minWidth: 160 }}>
                        {busy ? 'Searching…' : ready
                            ? `${matchingRows.length ? selectedIndex + 1 : 0} / ${matchingRows.length} matching lines`
                            : `${rows.length} loaded lines`}
                    </Typography>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <FormControlLabel control={<Checkbox checked={regex} onChange={(event) => changeOption(setRegex, event.target.checked)} />} label="Regex" />
                    <FormControlLabel control={<Checkbox checked={matchCase} onChange={(event) => changeOption(setMatchCase, event.target.checked)} />} label="Match case" />
                    <FormControlLabel control={<Checkbox checked={filter} onChange={(event) => setFilter(event.target.checked)} />} label="Filter matching lines" />
                    <Typography variant="caption">Search and filter apply to the loaded lines.</Typography>
                </Stack>
                {error && <Alert severity="error">{error} All loaded lines are shown.</Alert>}
            </Stack>
            <Box ref={contentRef} sx={{ minHeight: 0, flex: 1, overflow: 'auto', backgroundColor: '#111', color: '#fff' }}>
                {ready && filter && !visibleRows.length && <Box sx={{ p: 2 }}>No matching lines.</Box>}
                <Box component="pre" sx={{ m: 0, p: 2, fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'pre', lineHeight: 1.5 }}>
                    {visibleRows.map((row, rowIndex) => {
                        const parts = [];
                        let offset = 0;
                        row.matches.forEach(([start, end], matchIndex) => {
                            parts.push(row.text.slice(offset, start));
                            parts.push(<mark key={matchIndex} style={{ backgroundColor: '#ffd54f', color: '#111' }}>{row.text.slice(start, end)}</mark>);
                            offset = end;
                        });
                        parts.push(row.text.slice(offset));
                        return <React.Fragment key={row.index}>
                            <Box component="span" data-line={row.index} sx={{ backgroundColor: ready && row.index === selectedLine ? '#263850' : 'transparent' }}>
                                {parts}
                            </Box>
                            {rowIndex < visibleRows.length - 1 ? '\n' : ''}
                        </React.Fragment>;
                    })}
                </Box>
            </Box>
        </>
    );
}
LogContent.propTypes = { text: PropTypes.string.isRequired };
