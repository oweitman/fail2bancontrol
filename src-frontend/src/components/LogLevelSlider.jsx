import React from 'react';
import { Slider, Box } from '@mui/material';
import PropTypes from 'prop-types';

const LOGLEVELS = [
    'CRITICAL',
    'ERROR',
    'WARNING',
    'NOTICE',
    'INFO',
    'DEBUG',
    // 'TRACE-DEBUG',
    // 'HEAVY-DEBUG',
];

export default function LogLevelSlider({ value, onChange }) {
    const styles = {
        slider: {
            width: '100%',
            ml: 4,
            mr: 4,
            '& .MuiSlider-mark': {
                width: 4,
                height: 12,
                bgcolor: 'primary.main',
                transform: 'translateX(-50%)',
                opacity: 0.6,
            },
            '& .MuiSlider-markLabel': {
                position: 'absolute',
                top: 32, // Labels unter die Spur setzen
                fontSize: '0.75rem',
                whiteSpace: 'pre-line', // Zeilenumbruch durch \n erlauben
                lineHeight: 1.1,
                color: 'text.secondary',
                textAlign: 'center',
                transform: 'translateX(-50%)', // mittig zur Markierung
            },
            '& .MuiSlider-markLabel.MuiSlider-markLabelActive': {
                color: 'text.primary',
                fontWeight: 600,
            },
            '& .MuiSlider-markLabel:first-of-type': {
                transform: 'translateX(0%)',
                textAlign: 'left',
            },
            '& .MuiSlider-markLabel:last-of-type': {
                transform: 'translateX(-100%)',
                textAlign: 'right',
            },
            '& .MuiSlider-thumb': {
                width: 16,
                height: 16,
            },
            '& .MuiSlider-rail, & .MuiSlider-track': {
                height: 4,
            },
        },
    };

    // Labels mit Zeilenumbruch statt Bindestrich
    const marks = LOGLEVELS.map((label, idx) => ({
        value: idx,
        label: label.replace('-', '\n'),
    }));

    return (
        <Box sx={{ width: '90%' }}>
            <Slider
                value={Math.max(0, LOGLEVELS.indexOf(value))}
                onChange={(e, val) => onChange(LOGLEVELS[val])}
                min={0}
                max={LOGLEVELS.length - 1}
                step={1}
                marks={marks}
                sx={styles.slider}
            />
        </Box>
    );
}
LogLevelSlider.propTypes = {
    value: PropTypes.number.isRequired,
    onChange: PropTypes.func.isRequired,
};
