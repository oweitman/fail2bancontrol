import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import f2bLogo from '../assets/fail2ban-logo.png';
import Jail from './Jail.jsx';
import Overview from './Overview.jsx';

import { getGlobalStatus /* , getJailStatus, banIP, unbanIP */ } from './api';

export default function Fail2BanWebControl({ themeMode, setThemeMode }) {
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
        getGlobalStatus().then(setStatus).catch((error)=>setStatus({error:error.message}));
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
                error={status?.error }
                themeMode={themeMode}
                setThemeMode={setThemeMode}
            />
            {status?.list?.map((jail) => (
                <Jail key={jail} name={jail} />
            ))}
        </Box>
    );
}
