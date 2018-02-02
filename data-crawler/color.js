'use strict';

function toColor(value, code) {
    var r = `\x1b[${code}m${value}`;
    
    if (!r.endsWith('\x1b[0m'))
        r += '\x1b[0m';
        
    return r;
}

module.exports = {
    black: (value) => toColor(value, '30'),
    red: (value) => toColor(value, '31'),
    green: (value) => toColor(value, '32'),
    yellow: (value) => toColor(value, '33'),
    blue: (value) => toColor(value, '34'),
    magenta: (value) => toColor(value, '35'),
    cyan: (value) => toColor(value, '36'),
    white: (value) => toColor(value, '37'),

    black_bg: (value) => toColor(value, '40'),
    red_bg: (value) => toColor(value, '41'),
    green_bg: (value) => toColor(value, '42'),
    yellow_bg: (value) => toColor(value, '43'),
    blue_bg: (value) => toColor(value, '44'),
    magenta_bg: (value) => toColor(value, '45'),
    cyan_bg: (value) => toColor(value, '46'),
    white_bg: (value) => toColor(value, '47')
};
