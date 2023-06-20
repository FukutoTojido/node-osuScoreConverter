interface Input {
    time: number,
    x: number,
    y: number,
    inputArray: string[],
    idx: number,
}

interface Vec2 {
    x: number,
    y: number
}

interface CheckPointState {
    type: string,
    eval: number
}

interface SingleEval {
    val: number,
    valV2: number,
    bonus?: number,
    bonusV2?: number,
    delta?: number
    checkPointState?: CheckPointState[],
}

interface Eval {
    time: number,
    eval: number,
    sv2Eval: number,
    inputTime: number | null,
    type: string,
    checkPointState?: CheckPointState[],
    bonus?: number,
    bonusV2?: number,
    delta?: number,
}

interface TimingPoint {
    time: number,
    beatLength: number,
    meter: number,
    uninherited: number
}

interface Node {
    x: number,
    y: number,
    t: number
}

interface PointList {
    points: Vec2[] | Node[],
    length: number
}

interface SliderEval extends Node {
    type: string,
    time: number,
}

interface SliderEvalResult {
    type: string,
    eval: number
}

interface ModMultiplier {
    [key: string]: number
}

export { Input, Vec2, SingleEval, CheckPointState, Eval, TimingPoint, Node, PointList, SliderEval, SliderEvalResult, ModMultiplier }