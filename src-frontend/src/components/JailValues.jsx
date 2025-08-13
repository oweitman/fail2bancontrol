import * as React from 'react';
import {
    Card,
    CardHeader,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
} from '@mui/material';

export default function JailValues({ type, values }) {
    const styles = {
        card: {
            minWidth: '200px',
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
        tablecell: {
            borderBottom: 'none',
        },
    };
    const rows = [
        { name: 'Total', value: values.total },
        { name: 'Current', value: values.current },
    ];
    return (
        <Card sx={styles.card}>
            <CardHeader
                title={type}
                sx={styles.cardheader}
                slotProps={{
                    title: {
                        variant: 'h6',
                    },
                }}
            />
            <CardContent sx={styles.cardcontent}>
                <TableContainer component={Paper}>
                    <Table sx={{ xminWidth: 650 }} size="small">
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow
                                    key={row.name}
                                    sx={{
                                        '&:last-child td, &:last-child th': {
                                            border: 0,
                                        },
                                    }}
                                >
                                    <TableCell
                                        component="th"
                                        scope="row"
                                        sx={styles.tablecell}
                                    >
                                        {row.name}
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={styles.tablecell}
                                    >
                                        {row.value}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </CardContent>
        </Card>
    );
}
