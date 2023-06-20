import HitCircle from "./HitObjects/HitCircle.js";
import Slider from "./HitObjects/Slider.js";
import Spinner from "./HitObjects/Spinner.js";
import { Clamp, Dist } from "./Utils.js";
class Beatmap {
    rawMapData;
    static maxScore = 0;
    static maxCombo = 0;
    static baseData = {
        general: {},
        editor: {},
        metadata: {},
        difficulty: {
            HPDrainRate: 0,
            CircleSize: 0,
            OverallDifficulty: 0,
            ApproachRate: 0,
            SliderMultiplier: 1.4,
            SliderTickRate: 1
        },
        events: {
            breakPeriods: new Array
        },
        timingpoints: [],
        hitobjects: [],
        version: "",
    };
    ;
    static modMultiplier = 1;
    static difficultyMultiplier = 0;
    static stackOffset = 0;
    static hitWindows = {
        GREAT: 0,
        OK: 0,
        MEH: 0,
    };
    mods;
    constructor(rawMapData, modMultiplier, mods) {
        Beatmap.modMultiplier = modMultiplier;
        this.rawMapData = rawMapData;
        this.mods = mods;
        this.buildMapData();
        this.calculateMaximumScore();
    }
    static difficultyRange(val, min, mid, max) {
        if (val > 5)
            return mid + ((max - mid) * (val - 5)) / 5;
        if (val < 5)
            return mid - ((mid - min) * (5 - val)) / 5;
        return mid;
    }
    buildMapData() {
        if (!this.rawMapData)
            return;
        this.rawMapData.split("\r\n\r\n").forEach((curr) => {
            const lines = curr.split("\r\n");
            while (lines[0] === "")
                lines.shift();
            if (/\[[A-Za-z]+\]/g.test(lines[0])) {
                // const startProcess = performance.now();
                const tag = lines[0].slice(1).slice(0, -1).toLowerCase();
                lines.shift();
                lines.forEach((line, idx) => {
                    if (line === "")
                        return;
                    // Parse numeric and strings value to each attributes
                    if (/^[A-Za-z0-9_-]+:(\s)?.+/g.test(line)) {
                        // Since [Editor] and [Difficulty] sections have numeric values, we need to parse the value to float
                        const attr = line.split(":")[0];
                        if (tag === "general")
                            Beatmap.baseData.general[attr] = line.split(":")[1].trim();
                        if (tag === "metadata")
                            Beatmap.baseData.metadata[attr] = line.split(":")[1].trim();
                        if (tag === "difficulty")
                            Beatmap.baseData.difficulty[attr] = parseFloat(line.split(":")[1].trim());
                        if (tag === "editor")
                            Beatmap.baseData.editor[attr] = parseFloat(line.split(":")[1].trim());
                    }
                    if (tag === "timingpoints")
                        // Check if the current line is a TimingPoint
                        if (/^-?[0-9]+,-?[0-9]+(\.[0-9]+)?(,[0-9]+){1,6}$/g.test(line)) {
                            const nodes = line.split(",");
                            Beatmap.baseData.timingpoints.push({
                                time: parseInt(nodes[0]),
                                beatLength: parseFloat(nodes[1]),
                                meter: parseInt(nodes[2]),
                                uninherited: parseInt(nodes[6]),
                            });
                        }
                    if (tag === "events") {
                        // Check if the current line is a BreakPeriod
                        if (/^2,[0-9]+,[0-9]+$/g.test(line)) {
                            const nodes = line.split(",");
                            Beatmap.baseData.events.breakPeriods?.push({
                                start: parseInt(nodes[1]),
                                end: parseInt(nodes[2]),
                                length: parseInt(nodes[2]) - parseInt(nodes[1]),
                            });
                        }
                    }
                    if (tag === "hitobjects") {
                        const nodes = line.split(",");
                        // Check if the current line is a HitCircle
                        if (nodes[5] === undefined || /([0-9]+:){4}(.*)/g.test(nodes[5])) {
                            Beatmap.baseData.hitobjects.push(new HitCircle(line, idx));
                            return;
                        }
                        // Check if the current line is a Spinner
                        if (/^[0-9]+$/g.test(nodes[5])) {
                            Beatmap.baseData.hitobjects.push(new Spinner(line, idx));
                            return;
                        }
                        // Check if the current line is a Spinner
                        if (/[PCLB](\|-?[0-9]+:-?[0-9]+)+/g.test(nodes[5])) {
                            Beatmap.baseData.hitobjects.push(new Slider(line, idx));
                            return;
                        }
                    }
                });
                // console.log(`Time taken to process ${tag} ${((performance.now() - startProcess) / 1000).toFixed(2)}s`);
            }
            if (/osu file format v[0-9]+/g.test(lines[0]))
                Beatmap.baseData.version = lines?.[0]?.match(/(?<=(osu file format v))[0-9]+/g)?.shift();
        });
        const drainTime = (Beatmap.baseData.hitobjects.at(-1).time -
            (Beatmap.baseData.events.breakPeriods.reduce((accumulated, curr) => accumulated + curr.length, 0) + Beatmap.baseData.hitobjects[0].time)) /
            1000;
        Beatmap.difficultyMultiplier = Math.round(((Beatmap.baseData.difficulty.HPDrainRate +
            Beatmap.baseData.difficulty.CircleSize +
            Beatmap.baseData.difficulty.OverallDifficulty +
            Clamp((Beatmap.baseData.hitobjects.length / drainTime) * 8, 0, 16)) /
            38) *
            5);
        if (this.mods.includes("HardRock")) {
            Beatmap.baseData.difficulty.CircleSize = Math.min(Beatmap.baseData.difficulty.CircleSize * 1.3, 10);
            Beatmap.baseData.difficulty.ApproachRate = Math.min(Beatmap.baseData.difficulty.ApproachRate * 1.4, 10);
            Beatmap.baseData.difficulty.OverallDifficulty = Math.min(Beatmap.baseData.difficulty.OverallDifficulty * 1.4, 10);
        }
        if (this.mods.includes("Easy")) {
            Beatmap.baseData.difficulty.CircleSize = Math.min(Beatmap.baseData.difficulty.CircleSize / 2, 10);
            Beatmap.baseData.difficulty.ApproachRate = Math.min(Beatmap.baseData.difficulty.ApproachRate / 2, 10);
            Beatmap.baseData.difficulty.OverallDifficulty = Math.min(Beatmap.baseData.difficulty.OverallDifficulty / 2, 10);
        }
        Beatmap.stackOffset = (-6.4 * (1 - (0.7 * (Beatmap.baseData.difficulty.CircleSize - 5)) / 5)) / 2;
        Beatmap.hitWindows = {
            GREAT: Math.floor(80 - 6 * Beatmap.baseData.difficulty.OverallDifficulty),
            OK: Math.floor(140 - 8 * Beatmap.baseData.difficulty.OverallDifficulty),
            MEH: Math.floor(200 - 10 * Beatmap.baseData.difficulty.OverallDifficulty),
        };
        this.adjustForStacking();
    }
    adjustForStacking() {
        let extendedEndIndex = Beatmap.baseData.hitobjects.length - 1;
        let extendedStartIndex = 0;
        const stackDistance = 3;
        const preempt = Beatmap.difficultyRange(10 - Beatmap.baseData.difficulty.ApproachRate, 450, 1200, 1800);
        const stackThreshold = preempt * (Beatmap.baseData.general.StackLeniency ?? 0);
        for (let i = extendedEndIndex; i > 0; i--) {
            let n = i;
            let currentObj = Beatmap.baseData.hitobjects[i];
            if (currentObj.stackHeight != 0)
                continue;
            if (currentObj instanceof HitCircle) {
                while (--n >= 0) {
                    const nObj = Beatmap.baseData.hitobjects[n];
                    const endTime = nObj.endTime;
                    if (currentObj.time - endTime > stackThreshold)
                        break;
                    if (n < extendedStartIndex) {
                        nObj.stackHeight = 0;
                        extendedStartIndex = n;
                    }
                    // console.log(nObj.time);
                    if (nObj instanceof Slider && Dist(nObj.realTrackPoints.at(-1), currentObj) < stackDistance) {
                        let offset = currentObj.stackHeight - nObj.stackHeight + 1;
                        for (let j = n + 1; j <= i; j++) {
                            const jObj = Beatmap.baseData.hitobjects[j];
                            if (Dist(nObj.realTrackPoints.at(-1), jObj)) {
                                jObj.stackHeight -= offset;
                            }
                        }
                        break;
                    }
                    if (Dist(nObj, currentObj) < stackDistance) {
                        nObj.stackHeight = currentObj.stackHeight + 1;
                        currentObj = nObj;
                    }
                }
            }
            else if (currentObj instanceof Slider) {
                while (--n >= 0) {
                    // console.log(currentObj);
                    const nObj = Beatmap.baseData.hitobjects[n];
                    // console.log(nObj);
                    if (currentObj.time - nObj.time > stackThreshold)
                        break;
                    if (Dist(nObj instanceof Slider ? nObj.realTrackPoints.at(-1) : nObj, currentObj) < stackDistance) {
                        nObj.stackHeight = currentObj.stackHeight + 1;
                        currentObj = nObj;
                    }
                }
            }
        }
    }
    calculateMaximumScore() {
        if (!Beatmap.baseData)
            return;
        Beatmap.maxScore = Beatmap.baseData.hitobjects.reduce((accumulated, curr) => accumulated + curr.calculateScore(300), 0);
    }
}
export default Beatmap;
