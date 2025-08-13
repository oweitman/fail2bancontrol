import {
    Card,
    CardHeader,
    CardContent,
    Chip,
    Stack,
    Button,
} from '@mui/material';
import Jail from './Jail.jsx';

export default function Overview({ list, themeMode, setThemeMode }) {
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
        chip: {
            flex: '0 0 10px', // alle gleich breit
            justifyContent: 'center',
            whiteSpace: 'nowrap', // IP nicht umbrechen
        },
    };

    return (
        <Card id={`overview`} sx={styles.card}>
            <CardHeader
                title="Overview"
                sx={styles.cardheader}
                slotProps={{
                    title: {
                        variant: 'h4',
                    },
                }}
                action={
                    <Button
                        onClick={() =>
                            themeMode === 'dark'
                                ? setThemeMode('light')
                                : setThemeMode('dark')
                        }
                        variant="contained"
                        color="primary"
                        aria-label="refresh"
                    >
                        Toggle Theme
                    </Button>
                }
            />
            <CardContent sx={styles.cardcontent}>
                <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                    {list.map((jail) => (
                        <Chip
                            key={jail}
                            label={jail}
                            sx={styles.chip}
                            component="a"
                            href={`#jail-${jail}`}
                            clickable
                        />
                    ))}
                </Stack>
            </CardContent>
        </Card>
    );
}
