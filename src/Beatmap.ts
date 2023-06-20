import HitCircle from "./HitObjects/HitCircle.js";
import Slider from "./HitObjects/Slider.js";
import Spinner from "./HitObjects/Spinner.js";
import HitObject from "./HitObjects/HitObject.js";
import { Clamp, Dist } from "./Utils.js";
import { TimingPoint } from "./Types.js";

interface BreakPeriod {
    start: number,
    end: number,
    length: number,
}

interface General {
    AudioFilename?: string,
    AudioLeadIn?: number,
    PreviewTime?: number,
    Countdown?: number,
    SampleSet?: string,
    StackLeniency?: number,
    Mode?: number,
    LetterboxInBreaks?: number,
    WidescreenStoryboard?: number,
    [key: string]: string | number | undefined
}

interface Editor {
    Bookmarks?: number,
    DistanceSpacing?: number,
    BeatDivisor?: number,
    GridSize?: number,
    TimelineZoom?: number,
    [key: string]: | number | undefined
}

interface Metadata {
    Title?: string,
    TitleUnicode?: string,
    Artist?: string,
    ArtistUnicode?: string,
    Creator?: string,
    Version?: string,
    Source?: string | undefined,
    Tags?: string,
    BeatmapID?: string,
    BeatmapSetID?: string,
    [key: string]: string | undefined
}

interface Events {
    breakPeriods: BreakPeriod[]
}

interface Difficulty {
    HPDrainRate: number,
    CircleSize: number,
    OverallDifficulty: number,
    ApproachRate: number,
    SliderMultiplier: number,
    SliderTickRate: number
    [key: string]: number | undefined
}

interface BeatmapData {
    general: General,
    editor: Editor,
    metadata: Metadata,
    difficulty: Difficulty,
    events: Events,
    timingpoints: TimingPoint[],
    hitobjects: HitObject[]
    version: string | undefined,
}

interface HitWindows {
    GREAT: number,
    OK: number,
    MEH: number,
}

class Beatmap {
    private rawMapData: string;
    public static maxScore: number = 0;
    public static maxCombo: number = 0;
    public static baseData: BeatmapData = {
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
            breakPeriods: new Array<BreakPeriod>
        },
        timingpoints: [],
        hitobjects: [],
        version: "",
    };;
    public static modMultiplier: number = 1;
    public static difficultyMultiplier: number = 0;
    public static stackOffset: number = 0;
    public static hitWindows: HitWindows = {
        GREAT: 0,
        OK: 0,
        MEH: 0,
    }
    public mods: string[];

    constructor(rawMapData: string, modMultiplier: number, mods: string[]) {
        Beatmap.modMultiplier = modMultiplier;

        this.rawMapData = rawMapData;
        this.mods = mods;

        this.buildMapData();
        this.calculateMaximumScore();
    }

    public static difficultyRange(val: number, min: number, mid: number, max: number): number {
        if (val > 5) return mid + ((max - mid) * (val - 5)) / 5;
        if (val < 5) return mid - ((mid - min) * (5 - val)) / 5;
        return mid;
    }

    public buildMapData() {
        if (!this.rawMapData) return;

        this.rawMapData.split("\r\n\r\n").forEach((curr: string) => {
            const lines: string[] = curr.split("\r\n");
            while (lines[0] === "") lines.shift();

            if (/\[[A-Za-z]+\]/g.test(lines[0])) {
                // const startProcess = performance.now();

                const tag = lines[0].slice(1).slice(0, -1).toLowerCase();

                lines.shift();
                lines.forEach((line: string, idx: number) => {
                    if (line === "") return;

                    // Parse numeric and strings value to each attributes
                    if (/^[A-Za-z0-9_-]+:(\s)?.+/g.test(line)) {
                        // Since [Editor] and [Difficulty] sections have numeric values, we need to parse the value to float
                        const attr: string = line.split(":")[0];
                        if (tag === "general")
                            Beatmap.baseData.general[attr as keyof General] = line.split(":")[1].trim()

                        if (tag === "metadata")
                            Beatmap.baseData.metadata[attr as keyof Metadata] = line.split(":")[1].trim()

                        if (tag === "difficulty")
                            Beatmap.baseData.difficulty[attr as keyof Difficulty] = parseFloat(line.split(":")[1].trim())

                        if (tag === "editor")
                            Beatmap.baseData.editor[attr as keyof Editor] = parseFloat(line.split(":")[1].trim())
                    }

                    if (tag === "timingpoints")
                        // Check if the current line is a TimingPoint
                        if (/^-?[0-9]+,-?[0-9]+(\.[0-9]+)?(,[0-9]+){1,6}$/g.test(line)) {
                            const nodes: string[] = line.split(",");
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
                            const nodes: string[] = line.split(",");
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

            if (/osu file format v[0-9]+/g.test(lines[0])) Beatmap.baseData.version = lines?.[0]?.match(/(?<=(osu file format v))[0-9]+/g)?.shift();
        });

        const drainTime: number =
            (Beatmap.baseData.hitobjects.at(-1)!.time -
                (Beatmap.baseData.events.breakPeriods!.reduce((accumulated, curr) => accumulated + curr.length, 0) + Beatmap.baseData.hitobjects[0].time)) /
            1000;

        Beatmap.difficultyMultiplier = Math.round(
            ((Beatmap.baseData.difficulty!.HPDrainRate +
                Beatmap.baseData.difficulty!.CircleSize +
                Beatmap.baseData.difficulty!.OverallDifficulty +
                Clamp((Beatmap.baseData.hitobjects.length / drainTime) * 8, 0, 16)) /
                38) *
            5
        );

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

    private adjustForStacking() {
        let extendedEndIndex: number = Beatmap.baseData.hitobjects.length - 1;
        let extendedStartIndex: number = 0;
        const stackDistance: number = 3;
        const preempt: number = Beatmap.difficultyRange(10 - Beatmap.baseData.difficulty.ApproachRate, 450, 1200, 1800);
        const stackThreshold: number = preempt * (Beatmap.baseData.general.StackLeniency ?? 0);

        for (let i: number = extendedEndIndex; i > 0; i--) {
            let n: number = i;
            let currentObj: HitObject = Beatmap.baseData.hitobjects[i];

            if (currentObj.stackHeight != 0) continue;

            if (currentObj instanceof HitCircle) {
                while (--n >= 0) {
                    const nObj: HitObject = Beatmap.baseData.hitobjects[n];
                    const endTime: number = nObj.endTime;

                    if (currentObj.time - endTime > stackThreshold) break;
                    if (n < extendedStartIndex) {
                        nObj.stackHeight = 0;
                        extendedStartIndex = n;
                    }

                    // console.log(nObj.time);

                    if (nObj instanceof Slider && Dist(nObj.realTrackPoints.at(-1)!, currentObj) < stackDistance) {
                        let offset: number = currentObj.stackHeight - nObj.stackHeight + 1;

                        for (let j = n + 1; j <= i; j++) {
                            const jObj: HitObject = Beatmap.baseData.hitobjects[j];

                            if (Dist(nObj.realTrackPoints.at(-1)!, jObj)) {
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
            } else if (currentObj instanceof Slider) {
                while (--n >= 0) {
                    // console.log(currentObj);
                    const nObj: HitObject = Beatmap.baseData.hitobjects[n];
                    // console.log(nObj);
                    if (currentObj.time - nObj.time > stackThreshold) break;

                    if (Dist(nObj instanceof Slider ? nObj.realTrackPoints.at(-1)! : nObj, currentObj) < stackDistance) {
                        nObj.stackHeight = currentObj.stackHeight + 1;
                        currentObj = nObj;
                    }
                }
            }
        }
    }

    calculateMaximumScore() {
        if (!Beatmap.baseData) return;
        Beatmap.maxScore = Beatmap.baseData.hitobjects.reduce((accumulated, curr) => accumulated + curr.calculateScore(300), 0);
    }
}

export default Beatmap
