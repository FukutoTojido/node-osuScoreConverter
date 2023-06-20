import HitObject from "./HitObject.js";
import Beatmap from "../Beatmap.js";
import ScoreConverter from "../index.js";
import { SingleEval, Input } from "../Types.js";
import { TranslateToZero, ApplyModsToTime, Clamp } from "../Utils.js";

class Spinner extends HitObject {
    constructor(rawData: string, idx: number) {
        super(rawData, idx)
        const nodes = rawData.split(",");
        this.endTime = parseInt(nodes[5]);
    }

    public eval(inputIdx: number): SingleEval | null {
        const stat: { [key: string]: number }[] = [];
        const duration: number = this.endTime - this.time;

        let velocityOnPaper: number = 0; // Don't ask me. I'm trolling.
        let velocityCurrent: number = 0;

        let zeroCount: number = 0;

        let rotationCount: number = 0;
        let scoringRotationCount: number = 0;
        let previousRotationCount: number = 0;

        let previousAngle: number = 0;

        let bonus: number = 0;
        let bonusV2: number = 0;
        let rpm: number = 0;

        const OD: number = Beatmap.baseData.difficulty.OverallDifficulty;
        const RPS: number = Beatmap.difficultyRange(OD, 3, 5, 7.5);
        const requiredSpins: number = Math.floor((duration / 1000) * RPS);
        const minSpins: number = !ScoreConverter.isOldVersion ? Math.max(0, requiredSpins / 4) : requiredSpins;
        const fullSpin: number = !ScoreConverter.isOldVersion ? requiredSpins : requiredSpins + 1;
        const maxAccel: number = 8e-5 + Math.max(0, (5000 - duration) / 1000 / 2000);

        let idx: number = inputIdx;

        while (ScoreConverter.cursorInputData[idx].time < this.endTime) {
            if (ScoreConverter.cursorInputData[idx].time < this.time) {
                idx++;
                continue;
            }

            const currInput: Input = TranslateToZero(ScoreConverter.cursorInputData[idx]);
            const currentAngle: number = Math.atan2(currInput.y, currInput.x);

            previousAngle = !previousAngle ? (ScoreConverter.isOldVersion ? 0 : currentAngle) : previousAngle;

            let delta: number = currentAngle - previousAngle;
            let deltaCheck: number = currentAngle - previousAngle;

            const mPI: number = -Math.PI;

            if (deltaCheck < mPI) {
                delta += 2 * Math.PI;
            } else {
                deltaCheck *= -1;
                if (deltaCheck < mPI) delta -= 2 * Math.PI;
            }

            const timeDiff: number = currInput.time - ScoreConverter.cursorInputData[idx - 1].time;

            // I seriously don't know a shit about this
            if (delta === 0) {
                const wtf: number = zeroCount;
                zeroCount++;

                velocityOnPaper = wtf < 1 ? velocityOnPaper / 3 : 0;
            } else {
                zeroCount = 0;

                if (currInput.inputArray.length === 0 || currInput.time < this.time) delta = 0;
                if (Math.abs(delta) < Math.PI) {
                    // This is too insane up until this point
                    // Alright so this is like the mininum velocity due to the time delta should be at least 16.67ms
                    velocityOnPaper = (delta / 100) * 6;
                    // velocityOnPaper = delta / timeDiff;
                } else {
                    velocityOnPaper = 0;
                }
            }

            previousAngle = currentAngle;

            const maxVelo: number = ApplyModsToTime(maxAccel * timeDiff, ScoreConverter.mods);

            velocityCurrent += velocityOnPaper - velocityCurrent;
            // velocityCurrent += Math.min(velocityOnPaper - velocityCurrent, (velocityOnPaper > velocityCurrent ? 1 : -1) * maxVelo);
            velocityCurrent = Clamp(velocityCurrent, -0.05, 0.05);

            const decay: number = 0.9 ** ((timeDiff / 100) * 6);
            rpm = rpm * decay + (((1 - decay) * Math.abs(velocityCurrent) * 1000) / (2 * Math.PI)) * 60;

            // console.log(currInput.time, rotationCount, velocityOnPaper, velocityCurrent);

            const rotated: number = velocityCurrent * timeDiff;
            const rotatedByRPM: number = ((rpm * timeDiff) / 60000) * (Math.PI * 2);
            rotationCount += Math.min(1, Math.abs(rotated / Math.PI));
            // rotationCount += Math.min(1, Math.abs(rotatedByRPM / Math.PI));

            if (Math.floor(rotationCount) == previousRotationCount) {
                // console.log(currInput.time, rotationCount, velocityOnPaper, velocityCurrent, motherFucker);
                stat.push({
                    time: currInput.time,
                    delta: Math.abs((delta * 180) / Math.PI),
                    rotationCount,
                    result: 0,
                    rpm,
                    rotated,
                    rotatedByRPM,
                    diff: Math.abs(rotated) - Math.abs(rotatedByRPM),
                });
                idx++;
                continue;
            }

            scoringRotationCount++;

            let currentResult: number = 0;
            let currentResultV2: number = 0;

            if (scoringRotationCount > requiredSpins + 3 && (scoringRotationCount - (requiredSpins + 3)) % 2 === 0) {
                currentResult += 1100;
                currentResultV2 += 600;
            } else if (scoringRotationCount > 1 && scoringRotationCount % 2 === 0) {
                currentResult += 100;
                currentResultV2 += 100;
            }

            // console.log(currInput.time, rotationCount, velocityOnPaper, velocityCurrent, motherFucker, currentResult);
            stat.push({
                time: currInput.time,
                delta: Math.abs((delta * 180) / Math.PI),
                rotationCount,
                result: currentResult,
                rpm,
                rotated,
                rotatedByRPM,
                diff: Math.abs(rotated) - Math.abs(rotatedByRPM),
            });

            previousRotationCount = Math.floor(rotationCount);

            bonus += currentResult;
            bonusV2 += currentResultV2;

            idx++;
        }

        // console.table(stat);
        let val = 0;

        if (!ScoreConverter.isOldVersion) {
            val = scoringRotationCount < minSpins ? 0 : scoringRotationCount > fullSpin ? 300 : scoringRotationCount > fullSpin - 1 ? 100 : 50;
        } else {
            val =
                minSpins === 0
                    ? 300
                    : scoringRotationCount < minSpins
                        ? 0
                        : scoringRotationCount > fullSpin
                            ? 300
                            : scoringRotationCount > fullSpin - 2
                                ? 100
                                : 50;
        }

        return {
            val,
            valV2: val,
            bonus,
            bonusV2,
        };
    }

    public calculateScore(val: number): number {
        const score = Math.round(
            val * (1 + (Math.max(0, Beatmap.maxCombo - 1) * Beatmap.difficultyMultiplier * Beatmap.modMultiplier) / 25)
        );
        Beatmap.maxCombo++;

        return score;
    }
}

export default Spinner;

