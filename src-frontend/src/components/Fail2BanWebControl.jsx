import { React, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Stack, Typography } from '@mui/material';
import f2bLogo from '../assets/fail2ban-logo.png';
import Jail from './Jail.jsx';
import Overview from './Overview.jsx';
import Footer from './Footer.jsx';
import { getGlobalStatus } from './api';

export default function Fail2BanWebControl({ themeMode, setThemeMode }) {
    const [overviewRefresh, setOverviewRefresh] = useState(false);
    const [jailRefresh, setJailRefresh] = useState(false);
    const [status, setStatus] = useState(null);
    const styles = {
        fail2ban: {
            width: '900px',
        },
        h3: {
            margin: '16px 0px',
        },
    };

    useEffect(() => {
        getGlobalStatus()
            .then(setStatus)
            .catch((error) => setStatus({ error: error.message }));
    }, []);
    return (
        <Box sx={styles.fail2ban}>
            <Stack direction="row" spacing={2} alignItems="center">
                <img src={f2bLogo} className="logo f2b" alt="F2B logo" />
                <Typography variant="h3" align="left" sx={styles.h3}>
                    Fail2Ban Web Control
                </Typography>
            </Stack>

            <Overview
                list={status?.list || []}
                error={status?.error}
                themeMode={themeMode}
                setThemeMode={setThemeMode}
                doOverviewRefresh={setOverviewRefresh}
                overviewRefresh={overviewRefresh}
                setJailRefresh={setJailRefresh}
            />
            {status?.list?.map((jailname) => (
                <Jail
                    key={jailname}
                    jailname={jailname}
                    doOverviewRefresh={setOverviewRefresh}
                    setJailRefresh={setJailRefresh}
                    jailRefresh={jailRefresh}
                />
            ))}
            <Footer />
        </Box>
    );
}
Fail2BanWebControl.propTypes = {
    themeMode: PropTypes.string.isRequired,
    setThemeMode: PropTypes.func.isRequired,
    setJailRefresh: PropTypes.func.isRequired,
};
