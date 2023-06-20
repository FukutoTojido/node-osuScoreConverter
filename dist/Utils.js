const Clamp = (val, min, max) => Math.max(min, Math.min(val, max));
const Dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
const Add = (p1, p2) => {
    return { x: p1.x + p2.x, y: p1.y + p2.y };
};
const TranslateToZero = (point) => {
    const pointCop = { ...point };
    pointCop.x -= 256;
    pointCop.y -= 192;
    return pointCop;
};
const FlipHR = (coord) => {
    return { x: coord.x, y: 384 - coord.y };
};
const ApplyModsToTime = (time, mods) => {
    if (mods.includes("DoubleTime"))
        return time / 1.5;
    if (mods.includes("HalfTime"))
        return time / 0.75;
    return time;
};
const Fixed = (val, decimalPlace) => Math.round(val * (10 ** decimalPlace)) / (10 ** decimalPlace);
export { Clamp, Dist, Add, TranslateToZero, FlipHR, ApplyModsToTime, Fixed };
