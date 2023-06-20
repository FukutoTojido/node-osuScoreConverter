import HitObject from "./HitObject.js";
import HitCircle from "./HitCircle.js";
import Beatmap from "../Beatmap.js";
import { Dist, Clamp, Add, FlipHR, Fixed } from "../Utils.js";
import { Input, Vec2, SingleEval, Node, SliderEval, SliderEvalResult, PointList } from "../Types.js";
import ScoreConverter from "../index.js";
import fs from "fs"

const SLIDER_ACCURACY = 1 / 1000;

class Slider extends HitObject {
    private hitCircle: HitCircle;
    private repeat: number;
    private length: number;
    private sliderType: string;
    private nodeList: Vec2[];
    private beatStep: number;
    private beatLength: number;
    private SV: number;
    private sliderTicksCount: number;
    private sliderTime: number;
    private pointList: Node[];
    private sliderParts: SliderEval[] = [];
    private sliderEndEvalPosition?: SliderEval;
    public realTrackPoints: Node[];

    constructor(rawData: string, idx: number) {
        super(rawData, idx);

        const nodes: string[] = rawData.split(",");
        const sliderParams: string[] = nodes[5]
            ?.match(/[PCLB](\|-?[0-9]+:-?[0-9]+)+/g)
            ?.shift()
            ?.split("|") ?? [];

        this.hitCircle = new HitCircle(rawData, idx);
        this.repeat = parseInt(nodes[6]);
        this.length = parseFloat(nodes[7]);

        this.sliderType = sliderParams.shift() ?? "B";
        this.nodeList = [{ x: this.x, y: this.y }].concat(
            sliderParams.map((coord) => {
                return {
                    x: parseInt(coord.split(":")[0]),
                    y: parseInt(coord.split(":")[1]),
                };
            })
        );

        this.beatStep =
            Beatmap.baseData.timingpoints.filter((line) => line.uninherited && line.time <= this.time).at(-1)?.beatLength ?? Beatmap.baseData.timingpoints[0].beatLength;
        this.beatLength = Beatmap.baseData.timingpoints.filter((line) => line.time <= this.time).at(-1)?.beatLength ?? -100;
        this.SV = this.beatLength >= 0 ? 1 : Fixed((-100 / this.beatLength), 2);
        this.sliderTicksCount =
            (Math.ceil(Fixed(
                (this.length / this.SV / ((Beatmap.baseData.difficulty.SliderMultiplier * 100) / Beatmap.baseData.difficulty.SliderTickRate))
                , 2)) -
                1) *
            this.repeat;

        this.sliderTime = (this.beatStep * this.length) / this.SV / (Beatmap.baseData.difficulty.SliderMultiplier * 100);
        this.endTime = Math.round(this.time + this.sliderTime * this.repeat);

        const pointList: Node[] = this.getAngleList(this.nodeList);
        this.pointList = pointList;

        this.realTrackPoints = [...Array(this.repeat).keys()]
            .reduce<Node[]>((prev, curr, idx) => {
                let ret: Node[] = [];
                if (idx % 2 === 0) ret = prev.concat(pointList.slice(0, -1));
                if (idx % 2 !== 0) ret = prev.concat([...pointList].reverse().slice(0, -1));

                if (idx === this.repeat - 1) {
                    if (idx % 2 === 0) ret.push(pointList.at(-1)!);
                    else ret.push(pointList[0]);
                }

                return ret;
            }, [])
            .map((coord, idx) => {
                const ret: Node = { ...coord, t: idx / ((pointList.length - 1) * this.repeat + 1) }
                return ret;
            });

        // if (this.time === 75776)
        //     fs.writeFileSync("./motherFucker.json", JSON.stringify(this.realTrackPoints))

        this.getSliderPart();
    }

    private binom(n: number, k: number): number {
        if (k < 0 || k > n) return 0;
        if (k == 0 || k == n) return 1;

        let coeff: number = 1;
        for (let i: number = 0; i < k; i++) coeff = (coeff * (n - i)) / (i + 1);

        return coeff;
    }

    private bezier(t: number, plist: Vec2[]): Vec2 {
        const order: number = plist.length - 1;

        let x: number = 0;
        let y: number = 0;

        for (let i = 0; i <= order; i++) {
            x = x + this.binom(order, i) * Math.pow(1 - t, order - i) * Math.pow(t, i) * plist[i].x;
            y = y + this.binom(order, i) * Math.pow(1 - t, order - i) * Math.pow(t, i) * plist[i].y;
        }

        return {
            x: x,
            y: y,
        };
    }

    private createEquiDistCurve(points: Vec2[], actualLength: number): Vec2[] {
        let rPoints: Vec2[] = points;
        // Equal distance between Nodes
        const sectionDistance: number = actualLength * SLIDER_ACCURACY;

        for (let i = 0; i < rPoints.length - 1; i++) {
            let distanceToNextPoint: number = Dist(rPoints[i], rPoints[i + 1]);
            // console.log(i, rPoints[i], rPoints[i + 1], distanceToNextPoint);
            while (distanceToNextPoint < sectionDistance && i + 1 < rPoints.length - 1) {
                rPoints.splice(i + 1, 1);
                distanceToNextPoint = Dist(rPoints[i], rPoints[i + 1]);
            }

            if (distanceToNextPoint > sectionDistance) {
                const newPoints: Vec2[] = [];
                for (let j = 0; j < 1; j += sectionDistance / distanceToNextPoint) {
                    if (j === 0) continue;

                    const x = rPoints[i].x + ((rPoints[i + 1].x - rPoints[i].x) * sectionDistance) / distanceToNextPoint;
                    const y = rPoints[i].y + ((rPoints[i + 1].y - rPoints[i].y) * sectionDistance) / distanceToNextPoint;

                    newPoints.push({
                        x: x,
                        y: y,
                    });
                }

                rPoints = rPoints
                    .slice(0, i + 1)
                    .concat(newPoints)
                    .concat(rPoints.slice(i + 1));
            }
        }

        // console.log(limit);
        return rPoints;
    }

    private generatePointsList(controlPointsList: Vec2[]): PointList {
        let pointsList: Vec2[] = [];

        for (let i = 0; i < 1; i += SLIDER_ACCURACY) {
            pointsList.push(this.bezier(i, controlPointsList));
        }

        let length: number = 0;
        for (let i = 0; i < pointsList.length - 1; i++) {
            length += Dist(pointsList[i], pointsList[i + 1]);
        }

        pointsList = this.createEquiDistCurve(pointsList, this.length / this.repeat);

        let recalculatedLength = 0;
        for (let i = 0; i < pointsList.length - 1; i++) {
            recalculatedLength += Dist(pointsList[i], pointsList[i + 1]);
        }

        // console.log(pointsList, this.initialSliderLen / this.repeat, length, recalculatedLength);
        return {
            points: pointsList,
            length: recalculatedLength,
        };
    }

    private getCirclePoints(pointArr: Vec2[]): PointList {
        let innerAngle: number = 0;

        const lengthAB: number = Math.sqrt((pointArr[0].x - pointArr[1].x) ** 2 + (pointArr[0].y - pointArr[1].y) ** 2);
        const lengthBC: number = Math.sqrt((pointArr[1].x - pointArr[2].x) ** 2 + (pointArr[1].y - pointArr[2].y) ** 2);
        const lengthAC: number = Math.sqrt((pointArr[0].x - pointArr[2].x) ** 2 + (pointArr[0].y - pointArr[2].y) ** 2);

        const angleA: number = Math.acos(Clamp((lengthAB ** 2 + lengthAC ** 2 - lengthBC ** 2) / (2 * lengthAB * lengthAC), -1, 1));
        const angleB: number = Math.acos(Clamp((lengthAB ** 2 + lengthBC ** 2 - lengthAC ** 2) / (2 * lengthAB * lengthBC), -1, 1));
        const angleC: number = Math.acos(Clamp((lengthAC ** 2 + lengthBC ** 2 - lengthAB ** 2) / (2 * lengthAC * lengthBC), -1, 1));

        const radius: number = Clamp(lengthAB / (2 * Math.sin(angleC)), 0, Number.MAX_SAFE_INTEGER);

        const upper: number = pointArr[2].x - pointArr[0].x;
        const lower: number = pointArr[2].y - pointArr[0].y;

        // y = angleIndex * x + b
        const angleIndex: number = lower / upper;
        const b: number = pointArr[0].y - angleIndex * pointArr[0].x;

        const centerX: number =
            (pointArr[0].x * Math.sin(2 * angleA) + pointArr[1].x * Math.sin(2 * angleB) + pointArr[2].x * Math.sin(2 * angleC)) /
            (Math.sin(2 * angleA) + Math.sin(2 * angleB) + Math.sin(2 * angleC));
        const centerY: number =
            (pointArr[0].y * Math.sin(2 * angleA) + pointArr[1].y * Math.sin(2 * angleB) + pointArr[2].y * Math.sin(2 * angleC)) /
            (Math.sin(2 * angleA) + Math.sin(2 * angleB) + Math.sin(2 * angleC));

        const absoluteAngle: number =
            Math.abs(angleIndex) === Infinity || (pointArr[1].y - (angleIndex * pointArr[1].x + b)) * (centerY - (angleIndex * centerX + b)) < 0
                ? Math.asin(Clamp(lengthAC / (2 * radius), 0, 1)) * 2
                : Math.PI * 2 - Math.asin(Clamp(lengthAC / (2 * radius), 0, 1)) * 2;

        if (upper === 0) {
            if (lower === 0) {
                const firstHalf = this.generatePointsList([pointArr[0], pointArr[1]]);
                const secondHalf = this.generatePointsList([pointArr[1], pointArr[2]]);
                return {
                    points: (firstHalf.points as Vec2[]).concat(secondHalf.points),
                    length: firstHalf.length + secondHalf.length,
                };
            }

            const middle_start = pointArr[1].x - pointArr[0].x;
            const center_start = centerX - pointArr[0].x;

            if (middle_start < 0 && center_start >= 0) innerAngle = (lower > 0 ? -1 : 1) * absoluteAngle;
            if (middle_start > 0 && center_start <= 0) innerAngle = (lower > 0 ? 1 : -1) * absoluteAngle;
            if (middle_start > 0 && center_start >= 0) innerAngle = (lower > 0 ? -1 : 1) * Math.abs(Math.PI * 2 - absoluteAngle);
            if (middle_start < 0 && center_start <= 0) innerAngle = (lower > 0 ? 1 : -1) * Math.abs(Math.PI * 2 - absoluteAngle);
            if (middle_start == 0 && center_start == 0) {
                pointArr.splice(1, 1);
                return this.generatePointsList(pointArr);
            }

            // console.log(this.time, innerAngle, middle_start, center_start);
        } else {
            const projectile = {
                x: pointArr[1].x,
                y: pointArr[1].x * angleIndex + b,
            };
            if (Dist(projectile, pointArr[1]) < 0.1) {
                pointArr.splice(1, 1);
                return this.generatePointsList(pointArr);
            }
            innerAngle = upper * (pointArr[1].y - (angleIndex * pointArr[1].x + b)) < 0 ? absoluteAngle : -absoluteAngle;
        }

        // if (upper === 0) console.log(this.startTime, pointArr[2].y - pointArr[0].y, absoluteAngle);
        // console.log(this.time, (absoluteAngle * 180) / Math.PI, (innerAngle * 180) / Math.PI, upper, lower, angleIndex, b);

        const points: Vec2[] = [];
        let length = 0;

        // console.log(this.time, innerAngle, centerX, centerY, pointArr[0]);
        for (let i = 0; i < 1; i += SLIDER_ACCURACY) {
            const toPush: Vec2 = {
                x: centerX + (pointArr[0].x - centerX) * Math.cos(innerAngle * i) - (pointArr[0].y - centerY) * Math.sin(innerAngle * i),
                y: centerY + (pointArr[0].x - centerX) * Math.sin(innerAngle * i) + (pointArr[0].y - centerY) * Math.cos(innerAngle * i),
            };

            if (i > 0) length += Dist(points.at(-1)!, toPush);
            points.push(toPush);
        }

        return {
            points: points,
            length: length,
        };
    }

    private getAngleList(pointArr: Vec2[]): Node[] {
        let breakPoints: number[] = [];

        breakPoints.push(0);
        for (let i = 0; i < pointArr.length - 1; i++) {
            if (Dist(pointArr[i], pointArr[i + 1]) === 0) breakPoints.push(i);
        }
        breakPoints.push(pointArr.length - 1);

        const calculatedAngleLength: PointList = (
            this.sliderType === "P"
                ? this.getCirclePoints(pointArr)
                : breakPoints.reduce<PointList>((accumulated, bP, idx) => {
                    if (idx === breakPoints.length - 1) return accumulated;

                    const pointList: PointList = this.generatePointsList(pointArr.slice(breakPoints[idx] + (bP === 0 ? 0 : 1), breakPoints[idx + 1] + 1))
                    return {
                        points: (accumulated.points as Vec2[]).concat(pointList.points),
                        length: accumulated.length + pointList.length
                    }
                }, {
                    points: new Array<Vec2>,
                    length: 0
                })
        );

        const sliderLen = calculatedAngleLength.length;
        const limit = Math.floor((this.length / sliderLen) * (calculatedAngleLength.points.length - 1));

        const sliced = calculatedAngleLength.points.slice(0, limit);
        return sliced.map((coord, idx) => {
            return {
                ...coord,
                t: idx / (sliced.length - 1)
            };
        });
    }

    private getPointAtTime(time: number): Node {
        // console.log(this.time, Math.round(((time - this.time) / (this.sliderEndEvalPosition.time - this.time + 35)) * (this.actualTrackPoints.length - 1)));
        return this.realTrackPoints[
            Math.round(((time - this.time) / (this.endTime - this.time)) * (this.realTrackPoints.length - 1))
        ];
    }

    private getSliderPart(): void {
        const baseTicksList: Node[] = [];
        for (let i = 0; i < this.sliderTicksCount / this.repeat; i++) {
            baseTicksList.push(this.pointList[Math.round((((i + 1) * this.beatStep) / this.sliderTime) * this.pointList.length)]);
        }

        const sliderParts: SliderEval[] = [];
        const sliderEndEvalPosition: SliderEval = {
            ...this.pointList[Math.round((1 - 35 / (this.endTime)) * this.pointList.length)],
            type: "Slider End",
            time: this.endTime - 35,
        };

        for (let i = 0; i < this.repeat; i++) {
            // Time from the last slider tick to the slider end
            const tickEndDelta: number = this.sliderTime - (this.sliderTicksCount / this.repeat) * this.beatStep;
            const currentTrackPoint: Node = i % 2 === 0 ? this.pointList.at(-1)! : this.pointList[0];

            sliderParts.push(
                ...baseTicksList.map((tick, idx) => {
                    return {
                        ...tick,
                        type: "Slider Tick",
                        time:
                            i % 2 === 0
                                ? i * this.sliderTime + Math.floor(this.time + (idx + 1) * this.beatStep)
                                : (i - 1) * this.sliderTime + Math.floor(this.time + this.sliderTime + idx * this.beatStep + tickEndDelta),
                    };
                })
            );

            if (i < this.repeat - 1)
                sliderParts.push({
                    ...currentTrackPoint,
                    type: "Slider Repeat",
                    time: this.time + Math.round((i + 1) * this.sliderTime),
                });
        }

        this.sliderParts = sliderParts;
        this.sliderEndEvalPosition = sliderEndEvalPosition;
    }

    public eval(inputIdx: number): SingleEval | null {
        const radius: number = 54.4 - 4.48 * Beatmap.baseData.difficulty.CircleSize;
        let currentInput: Input = ScoreConverter.cursorInputData[inputIdx];

        const val: SingleEval | null = this.hitCircle.eval(inputIdx);
        if (val === null) return null;

        let state = "UNTRACKING";
        let internalInputIdx = inputIdx;
        let sliderPartIdx = 0;

        const sliderParts: SliderEval[] = (this.sliderParts as SliderEval[])
            .concat([this.sliderEndEvalPosition] as SliderEval[])
            .sort((a: SliderEval, b: SliderEval): number => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
        const sliderPartsEval: SliderEvalResult[] = [{ type: "Slider Head", eval: val.val === 0 ? 0 : 1 }];

        const additionalMemory: Vec2 = {
            x: this.stackHeight * Beatmap.stackOffset,
            y: this.stackHeight * Beatmap.stackOffset,
        };

        while (currentInput.time <= this.endTime) {
            const pointAtT: Node = this.getPointAtTime(currentInput.time);

            if (!pointAtT) {
                currentInput = ScoreConverter.cursorInputData[++internalInputIdx];
                continue;
            }

            const accountedPointAtT: Vec2 = ScoreConverter.mods.includes("HardRock") ? Add(FlipHR(pointAtT), additionalMemory) : Add(pointAtT, additionalMemory);

            // Untrack slider if release keys / move out of slider follow circle
            if (state === "TRACKING")
                if (currentInput.inputArray.length === 0 || Fixed(Dist(currentInput, accountedPointAtT) / (2.4 * radius), 5) > 1)
                    state = "UNTRACKING";

            // Track slider if press keys AND move inside of sliderB
            if (state === "UNTRACKING")
                if (currentInput.inputArray.length !== 0 && Fixed((Dist(currentInput, accountedPointAtT) / radius), 5) < 1) state = "TRACKING";

            if (sliderParts[sliderPartIdx] && ScoreConverter.cursorInputData[internalInputIdx + 1].time >= sliderParts[sliderPartIdx]?.time) {
                sliderPartsEval.push({
                    type: sliderParts[sliderPartIdx].type,
                    eval: state === "TRACKING" && currentInput.time <= sliderParts[sliderPartIdx].time ? 1 : 0,
                });

                sliderPartIdx++;
            }

            // if (currentObj.time === 207422)
            //     console.log(currentInput.time, state, accountedPointAtT, currentObj.stackHeight);

            if (!sliderParts[sliderPartIdx] || sliderParts[sliderPartIdx].time >= ScoreConverter.cursorInputData[internalInputIdx + 1].time) internalInputIdx++;
            currentInput = ScoreConverter.cursorInputData[internalInputIdx];
        }

        // console.log(currentObj.time, sliderPartsEval);
        const evaluated = sliderPartsEval.every((checkPoint) => checkPoint.eval === 1)
            ? 300
            : sliderPartsEval.every((checkPoint) => checkPoint.eval === 0)
                ? 0
                : sliderPartsEval.filter((checkPoint) => checkPoint.eval === 1).length * 2 >=
                    1 + this.sliderTicksCount * this.repeat + this.repeat
                    ? 100
                    : 50;

        return {
            val: evaluated,
            valV2: val.val,
            checkPointState: sliderPartsEval,
            delta: val.delta,
        };
    }

    public calculateScore(val: number): number {
        const sliderHeadScore: number = 30;
        Beatmap.maxCombo++;

        const sliderTailRepeatScore: number = this.repeat * 30;
        Beatmap.maxCombo += this.repeat;

        const sliderTicksScore: number = this.sliderTicksCount * 10;
        Beatmap.maxCombo += this.sliderTicksCount;

        const sliderScore = Math.round(
            val * (1 + (Math.max(0, Beatmap.maxCombo - 1) * Beatmap.difficultyMultiplier * Beatmap.modMultiplier) / 25) +
            sliderHeadScore +
            sliderTailRepeatScore +
            sliderTicksScore
        );

        return sliderScore;
    }
}

export default Slider;
