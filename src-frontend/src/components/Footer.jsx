// src/components/Footer.jsx
import { React, useEffect, useState } from 'react';
import { Box, Stack, Link, Typography, Chip } from '@mui/material';
import { getLatestVersion, cmpSemver } from '../utils/version';

/* global __APP_VERSION__ */

export default function Footer() {
    const [latest, setLatest] = useState(null);
    const current = __APP_VERSION__; // injected by Vite

    useEffect(() => {
        let mounted = true;
        (async () => {
            const v = await getLatestVersion();
            if (mounted) setLatest(v);
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const updateAvailable = latest && cmpSemver(latest, current) === 1;

    const styles = {
        root: {
            borderTop: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            color: 'var(--text-color)',
            padding: '10px 20px',
            marginTop: '20px',
        },
        link: {
            color: 'var(--accent-color)',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
        },
    };

    return (
        <Box component="footer" sx={styles.root}>
            <Stack
                direction="row"
                spacing={3}
                justifyContent="center"
                alignItems="center"
                flexWrap="wrap"
            >
                <Typography variant="body2">
                    <Link
                        href="https://github.com/oweitman/fail2bancontrol"
                        target="_blank"
                        rel="noopener"
                        sx={styles.link}
                    >
                        GitHub
                    </Link>
                </Typography>
                <Typography variant="body2">
                    <Link
                        href="https://hub.docker.com/r/oweitman/fail2bancontrol"
                        target="_blank"
                        rel="noopener"
                        sx={styles.link}
                    >
                        Docker Hub
                    </Link>
                </Typography>
                <Typography variant="body2">
                    <Link
                        href="https://github.com/oweitman/fail2bancontrol/issues"
                        target="_blank"
                        rel="noopener"
                        sx={styles.link}
                    >
                        Support & Issues
                    </Link>
                </Typography>
                <Typography variant="body2">
                    <Link
                        href="https://github.com/oweitman/fail2bancontrol/releases"
                        target="_blank"
                        rel="noopener"
                        sx={styles.link}
                    >
                        Releases
                    </Link>
                </Typography>

                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    v{current}
                </Typography>

                {latest && (
                    <Typography variant="body2" sx={{ opacity: 0.75 }}>
                        (latest: {latest})
                    </Typography>
                )}

                {updateAvailable && (
                    <Chip
                        label={`Update available: ${latest}`}
                        color="warning"
                        component="a"
                        clickable
                        href="https://github.com/oweitman/fail2bancontrol/releases"
                        target="_blank"
                        rel="noopener"
                        sx={{ ml: 1 }}
                    />
                )}
            </Stack>
        </Box>
    );
}
