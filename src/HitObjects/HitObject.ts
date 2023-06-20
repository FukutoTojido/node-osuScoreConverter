import { SingleEval } from "../Types.js";

export default class HitObject {
    public x: number;
    public y: number;
    public time: number;
    public endTime: number;
    public idx: number;
    public stackHeight: number;

    constructor(rawData: string, idx: number) {
        const nodes: string[] = rawData.split(",");

        this.x = parseInt(nodes[0]);
        this.y = parseInt(nodes[1]);
        this.time = parseInt(nodes[2]);
        this.endTime = parseInt(nodes[2]);
        this.idx = idx;
        this.stackHeight = 0;

    }

    public eval(inputIdx: number): SingleEval | null {
        return null;
    }

    public calculateScore(value: number): number {
        return 0;
    }
}