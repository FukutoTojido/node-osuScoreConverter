import { Input, Vec2, SingleEval } from "../Types.js"
import HitObject from "./HitObject.js";
import Beatmap from "../Beatmap.js";
import { Dist, Clamp, Add, TranslateToZero, FlipHR, Fixed } from "../Utils.js"
import ScoreConverter from "../index.js";

class HitCircle extends HitObject {
    constructor(rawData: string, idx: number) {
        super(rawData, idx);
    }

    eval(inputIdx: number): SingleEval | null {
        const radius: number = 54.4 - 4.48 * Beatmap.baseData.difficulty.CircleSize;
        const currentInput: Input = ScoreConverter.cursorInputData[inputIdx];

        // Input before Hit Window
        if (currentInput.time - this.time <= -Beatmap.hitWindows.MEH) return null;
        // Input after Hit Window
        if (currentInput.time - this.time >= Beatmap.hitWindows.MEH) return { val: 0, valV2: 0 };
        // Input during Note Lock
        if (ScoreConverter.evalList.at(-1)?.eval === 0 && Math.abs(currentInput.time - (ScoreConverter.evalList.at(-1)?.time ?? currentInput.time)) < Beatmap.hitWindows.MEH) return null;

        // Input while not pressing any keys / releasing keys
        const prevInput: Input = ScoreConverter.cursorInputData[inputIdx - 1];
        if (
            currentInput.inputArray.length === 0 ||
            prevInput.inputArray.length > currentInput.inputArray.length ||
            (prevInput.inputArray.length === currentInput.inputArray.length &&
                JSON.stringify(prevInput.inputArray) === JSON.stringify(currentInput.inputArray))
        )
            return null;

        const additionalMemory: Vec2 = {
            x: this.stackHeight * Beatmap.stackOffset,
            y: this.stackHeight * Beatmap.stackOffset,
        };

        // Misaim
        if (
            (
                Fixed(Dist(
                    currentInput,
                    ScoreConverter.mods.includes("HardRock") ? Add(FlipHR(this), additionalMemory) : Add(this, additionalMemory)
                ) / radius, 2)
            ) > 1
        ) {
            return null;
        }

        let val: number = 0;
        const delta: number = Math.abs(currentInput.time - this.time);

        if (delta < Beatmap.hitWindows.GREAT) val = 300;
        if (delta >= Beatmap.hitWindows.GREAT && delta < Beatmap.hitWindows.OK) val = 100;
        if (delta >= Beatmap.hitWindows.OK && delta < Beatmap.hitWindows.MEH) val = 50;

        return { val, valV2: val, delta: currentInput.time - this.time };
    }

    calculateScore(val: number) {
        const score = Math.round(
            val * (1 + (Math.max(0, Beatmap.maxCombo - 1) * Beatmap.difficultyMultiplier * Beatmap.modMultiplier) / 25)
        );
        Beatmap.maxCombo++;

        // console.log(this.time, score, baseBeatmap.combo, baseBeatmap.difficultyMultiplier, baseBeatmap.modMultiplier);
        return score;
    }
}

export default HitCircle;
