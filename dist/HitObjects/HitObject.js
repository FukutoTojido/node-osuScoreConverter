export default class HitObject {
    x;
    y;
    time;
    endTime;
    idx;
    stackHeight;
    constructor(rawData, idx) {
        const nodes = rawData.split(",");
        this.x = parseInt(nodes[0]);
        this.y = parseInt(nodes[1]);
        this.time = parseInt(nodes[2]);
        this.endTime = parseInt(nodes[2]);
        this.idx = idx;
        this.stackHeight = 0;
    }
    eval(inputIdx) {
        return null;
    }
    calculateScore(value) {
        return 0;
    }
}
