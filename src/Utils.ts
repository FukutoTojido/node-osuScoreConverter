import { Vec2, Node, Input } from "./Types.js"
import HitObject from "./HitObjects/HitObject.js";

type Point = Vec2 | HitObject | Node | Input;

const Clamp = (val: number, min: number, max: number): number => Math.max(min, Math.min(val, max));
const Dist = (p1: Point, p2: Point): number => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
const Add = (p1: Point, p2: Point): Point => {
    return { x: p1.x + p2.x, y: p1.y + p2.y };
};
const TranslateToZero = (point: Input): Input => {
    const pointCop: Input = { ...point };
    pointCop.x -= 256;
    pointCop.y -= 192;

    return pointCop;
};
const FlipHR = (coord: Point): Point => {
    return { x: coord.x, y: 384 - coord.y };
}
const ApplyModsToTime = (time: number, mods: string[]): number => {
    if (mods.includes("DoubleTime"))
        return time / 1.5;

    if (mods.includes("HalfTime"))
        return time / 0.75;

    return time;
}
const Fixed = (val: number, decimalPlace: number): number => Math.round(val * (10 ** decimalPlace)) / (10 ** decimalPlace);
const Pad = (value: number, padSize: number, padStart: boolean = false): string => padStart ? value.toString().padStart(padSize, " ") : value.toString().padEnd(padSize, " ")
const LinearEstimation = (start: Point, end: Point, t: number): Vec2 => {
    const deltaX: number = end.x - start.x;
    const deltaY: number = end.y - start.y;

    return {
        x: start.x + deltaX * t,
        y: start.y + deltaY * t
    }
}

export { Clamp, Dist, Add, TranslateToZero, FlipHR, ApplyModsToTime, Fixed, Pad, LinearEstimation };