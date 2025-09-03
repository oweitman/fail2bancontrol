import { React, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Card, CardHeader, CardContent, Chip, Stack } from '@mui/material';
import { unbanIP } from './api';
export default function BannedIPs({ jailname, ips, refreshStatus }) {
    const [ipList, setIPList] = useState([]);
    useEffect(() => {
        setIPList(ips);
    }, [ips]);
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
    };
    const sortIP = (a, b) => {
        return (
            Number(
                a
                    .split('.')
                    .map(Number)
                    .reduce(
                        (acc, val) => acc + String(val).padStart(3, '0'),
                        ''
                    )
            ) -
            Number(
                b
                    .split('.')
                    .map(Number)
                    .reduce(
                        (acc, val) => acc + String(val).padStart(3, '0'),
                        ''
                    )
            )
        );
    };

    const handleDelete = async (ipToDelete) => {
        await unbanIP(jailname, ipToDelete);
        refreshStatus();
    };
    return (
        <Card sx={styles.card}>
            <CardHeader
                title="Banned IPs"
                sx={styles.cardheader}
                slotProps={{
                    title: {
                        variant: 'h6',
                    },
                }}
            />
            <CardContent sx={styles.cardcontent}>
                <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                    {ipList.sort(sortIP).map((ip) => (
                        <Chip
                            key={ip}
                            label={ip}
                            sx={styles.chip}
                            onDelete={() => handleDelete(ip)}
                        />
                    ))}
                </Stack>
            </CardContent>
        </Card>
    );
}
BannedIPs.propTypes = {
    jailname: PropTypes.number.isRequired,
    ips: PropTypes.array.isRequired,
    refreshStatus: PropTypes.func.isRequired,
};
