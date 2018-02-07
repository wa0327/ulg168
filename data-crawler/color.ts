
function toColor(value: string, code: string) {
    var r = `\x1b[${code}m${value}`;
    
    if (!r.endsWith('\x1b[0m'))
        r += '\x1b[0m';
        
    return r;
}

const color = {
    black: (value: string) => toColor(value, '30'),
    red: (value: string) => toColor(value, '31'),
    green: (value: string) => toColor(value, '32'),
    yellow: (value: string) => toColor(value, '33'),
    blue: (value: string) => toColor(value, '34'),
    magenta: (value: string) => toColor(value, '35'),
    cyan: (value: string) => toColor(value, '36'),
    white: (value: string) => toColor(value, '37'),
    black_bg: (value: string) => toColor(value, '40'),
    red_bg: (value: string) => toColor(value, '41'),
    green_bg: (value: string) => toColor(value, '42'),
    yellow_bg: (value: string) => toColor(value, '43'),
    blue_bg: (value: string) => toColor(value, '44'),
    magenta_bg: (value: string) => toColor(value, '45'),
    cyan_bg: (value: string) => toColor(value, '46'),
    white_bg: (value: string) => toColor(value, '47')
};

class Color {
    black(value: string) { return toColor(value, '30'); }
    red(value: string) { return toColor(value, '31'); }
    green(value: string) { return toColor(value, '32'); }
    yellow(value: string) { return toColor(value, '33'); }
    blue(value: string) { return toColor(value, '34'); }
    magenta(value: string) { return toColor(value, '35'); }
    cyan(value: string) { return toColor(value, '36'); }
    white(value: string) { return toColor(value, '37'); }

    black_bg(value: string) { return toColor(value, '40'); }
    red_bg(value: string) { return toColor(value, '41'); }
    green_bg(value: string) { return toColor(value, '42'); }
    yellow_bg(value: string) { return toColor(value, '44'); }
    blue_bg(value: string) { return toColor(value, '44'); }
    magenta_bg(value: string) { return toColor(value, '45'); }
    cyan_bg(value: string) { return toColor(value, '46'); }
    white_bg(value: string) { return toColor(value, '47'); }
};

export {
    color,
    Color
};
