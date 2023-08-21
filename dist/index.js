import { Replay } from "@minhducsun2002/node-osr-parser";
import Beatmap from "./Beatmap.js";
import axios from "axios";
import fs from "fs";
import { Fixed, ApplyModsToTime } from "./Utils.js";
const modsList = [
    "NoFail",
    "Easy",
    "TouchDevice",
    "Hidden",
    "HardRock",
    "SuddenDeath",
    "DoubleTime",
    "Relax",
    "HalfTime",
    "Nightcore",
    "Flashlight",
    "Autoplay",
    "SpunOut",
    "Autopilot",
    "Perfect",
    "Key4",
    "Key5",
    "Key6",
    "Key7",
    "Key8",
    "FadeIn",
    "Random",
    "Cinema",
    "Target",
    "Key9",
    "KeyCoop",
    "Key1",
    "Key3",
    "Key2",
    "ScoreV2",
    "Mirror",
];
const modsMultiplierList = {
    V1: {
        NoFail: 0.5,
        Easy: 0.5,
        HalfTime: 0.3,
        HardRock: 1.06,
        Hidden: 1.06,
        DoubleTime: 1.12,
        Flashlight: 1.12,
    },
    V2: {
        NoFail: 1,
        Easy: 0.5,
        HalfTime: 0.3,
        HardRock: 1.1,
        Hidden: 1.06,
        DoubleTime: 1.2,
        Flashlight: 1.12,
    },
};
const inputList = ["SMOKE", "K2", "K1", "M2", "M1"];
export default class ScoreConverter {
    static evalList;
    static replayData;
    static isOldVersion;
    static cursorInputData;
    static mods;
    static map;
    static maxCombo;
    rawReplay;
    comboPortion = 0;
    maxComboPortion = 0;
    localMap = false;
    rawMap = "";
    getIsOldVersion(version) {
        let versionString = version.toString();
        const year = parseInt(versionString.match(/.{1,4}/g)?.[0] ?? "0");
        const month = parseInt(versionString
            .match(/.{1,4}/g)?.[1]
            .match(/.{1,2}/g)?.[0]
            ?? "0");
        const day = parseInt(versionString
            .match(/.{1,4}/g)?.[1]
            .match(/.{1,2}/g)?.[1]
            ?? "0");
        if (year <= 2019 && month < 5 && day < 10)
            return true;
        return false;
    }
    async readReplay() {
        const rawData = this.rawReplay;
        const replay = new Replay(rawData);
        const replayData = await replay.deserialize();
        ScoreConverter.replayData = replayData;
        ScoreConverter.isOldVersion = this.getIsOldVersion(replayData.version);
        let timestamp = 0;
        ScoreConverter.cursorInputData = replayData.replayData
            .split(",")
            .filter((data) => data !== "")
            .map((data, idx) => {
            const nodes = data.split("|");
            if (nodes[0] === "-12345")
                return {
                    time: 0,
                    x: 0,
                    y: 0,
                    inputArray: [],
                    idx,
                };
            timestamp += parseFloat(nodes[0]);
            return {
                time: timestamp,
                x: parseFloat(nodes[1]),
                y: parseFloat(nodes[2]),
                inputArray: parseInt(nodes[3])
                    .toString(2)
                    .padStart(5, "0")
                    .split("")
                    .reduce((prev, curr, idx) => (curr === "1" && idx !== 0 ? prev.concat([inputList[idx]]) : prev), []),
                idx,
            };
        });
        fs.writeFileSync("./replay.json", JSON.stringify(ScoreConverter.cursorInputData));
        if (!this.localMap) {
            const mapInfo = (await axios.get(`https://tryz.vercel.app/api/h/${replayData.md5map}`)).data;
            this.rawMap = (await axios.get(`https://tryz.vercel.app/api/b/${mapInfo.mapId}/osu`)).data;
        }
        const mods = replayData.mods
            .toString(2)
            .padStart(31, "0")
            .split("")
            .reduce((accumulated, current, idx) => {
            if (current === "1")
                accumulated.push(modsList[modsList.length - 1 - idx]);
            return accumulated;
        }, []);
        ScoreConverter.mods = mods;
        const modMultiplier = mods.reduce((prev, curr) => {
            return {
                V1: modsMultiplierList.V1[curr] ? prev.V1 * modsMultiplierList.V1[curr] : prev.V1,
                V2: modsMultiplierList.V2[curr] ? prev.V2 * modsMultiplierList.V2[curr] : prev.V2,
            };
        }, {
            V1: 1,
            V2: 1,
        });
        ScoreConverter.map = new Beatmap(this.rawMap, mods.includes("ScoreV2") ? modMultiplier.V2 : modMultiplier.V1, mods);
    }
    eval() {
        let currentObjIdx = 0;
        let currentInputIdx = 1;
        while (currentInputIdx < ScoreConverter.cursorInputData.length) {
            if (currentObjIdx >= Beatmap.baseData.hitobjects.length)
                break;
            const currentObj = Beatmap.baseData.hitobjects[currentObjIdx];
            const currentInput = ScoreConverter.cursorInputData[currentInputIdx];
            if (ScoreConverter.evalList.at(-1)?.time === currentObj.time) {
                currentObjIdx++;
                continue;
            }
            const val = currentObj.eval(currentInputIdx);
            if (val === null) {
                currentInputIdx++;
                continue;
            }
            ScoreConverter.evalList.push({
                time: currentObj.time,
                eval: val.val,
                sv2Eval: val.valV2,
                inputTime: val.val === 0 ? null : currentInput.time,
                type: currentObj.constructor.name,
                checkPointState: val.checkPointState,
                bonus: val.bonus,
                bonusV2: val.bonusV2,
                delta: val.delta,
            });
            currentInputIdx++;
            currentObjIdx++;
        }
        fs.writeFileSync("./test.json", JSON.stringify(ScoreConverter.evalList, null, "\t"));
    }
    calculateScore() {
        let combo = 0;
        let maxCombo = 0;
        ScoreConverter.maxCombo = 0;
        // console.log(this.map.difficultyMultiplier, this.map.modMultiplier);
        const filtered = ScoreConverter.evalList.filter(input => input.delta !== undefined).map(input => ApplyModsToTime(input.delta, ScoreConverter.mods));
        const deltaSum = filtered.reduce((prev, curr) => prev + curr, 0);
        const avg = deltaSum / filtered.length;
        const deltaSquaredSum = filtered.reduce((prev, curr) => prev + ((curr - avg) ** 2), 0);
        const UR = Fixed(Math.sqrt(deltaSquaredSum / (filtered.length - 1)) * 10, 2);
        const data = ScoreConverter.evalList.reduce((accumulated, hitData) => {
            if (hitData.type !== "Slider") {
                maxCombo++;
                if (hitData.eval === 0) {
                    combo = 0;
                    accumulated.acc.V1.h0++;
                    accumulated.acc.V2.h0++;
                    return accumulated;
                }
                const score = Math.round(hitData.eval * (1 + (Math.max(0, combo - 1) * Beatmap.difficultyMultiplier * Beatmap.modMultiplier) / 25));
                combo++;
                if (combo > ScoreConverter.maxCombo)
                    ScoreConverter.maxCombo = combo;
                if (hitData.eval === 300) {
                    accumulated.acc.V1.h300++;
                    accumulated.acc.V2.h300++;
                }
                if (hitData.eval === 100) {
                    accumulated.acc.V1.h100++;
                    accumulated.acc.V2.h100++;
                }
                if (hitData.eval === 50) {
                    accumulated.acc.V1.h50++;
                    accumulated.acc.V2.h50++;
                }
                this.comboPortion += hitData.eval * (1 + combo / 10);
                this.maxComboPortion += 300 * (1 + maxCombo / 10);
                // console.log({ comboPortion: this.comboPortion, max: this.maxComboPortion })
                return {
                    V1: accumulated.V1 + score,
                    V1_S: accumulated.V1_S + score,
                    acc: accumulated.acc,
                    bonus: accumulated.bonus + (hitData.bonus ?? 0),
                    bonusV2: accumulated.bonusV2 + (hitData.bonusV2 ?? 0),
                };
            }
            let tickScore = 0, repeatScore = 0, headScore = 0, tailScore = 0;
            let valV1 = hitData.eval;
            let valV2 = hitData.sv2Eval;
            let tempMaxCombo = maxCombo;
            hitData.checkPointState.filter((checkPoint) => checkPoint.type !== "Slider Tick").forEach((checkPoint) => {
                tempMaxCombo++;
                this.maxComboPortion += 30 * (1 + tempMaxCombo / 10);
            });
            hitData.checkPointState.filter((checkPoint) => checkPoint.type === "Slider Tick").forEach((checkPoint) => {
                tempMaxCombo++;
                this.maxComboPortion += 10 * (1 + tempMaxCombo / 10);
            });
            hitData.checkPointState.forEach((checkPoint) => {
                maxCombo++;
                if (checkPoint.eval === 1) {
                    combo++;
                    switch (checkPoint.type) {
                        case "Slider Head":
                            headScore += 30;
                            this.comboPortion += 30 * (1 + combo / 10);
                            break;
                        case "Slider Tick":
                            tickScore += 10;
                            this.comboPortion += 10 * (1 + combo / 10);
                            break;
                        case "Slider Repeat":
                            repeatScore += 30;
                            this.comboPortion += 30 * (1 + combo / 10);
                            break;
                        case "Slider End":
                            tailScore += 30;
                            this.comboPortion += 30 * (1 + combo / 10);
                    }
                    // console.log({ comboPortion: this.comboPortion, max: this.maxComboPortion })
                    if (valV2 < 50)
                        valV2 = 50;
                    if (combo > ScoreConverter.maxCombo)
                        ScoreConverter.maxCombo = combo;
                }
                else {
                    if (checkPoint.type !== "Slider End") {
                        combo = 0;
                        if (valV2 > 50)
                            valV2 = 50;
                    }
                    else {
                        if (valV1 > 100)
                            valV1 = 100;
                        if (valV2 > 100)
                            valV2 = 100;
                    }
                }
            });
            const sliderScoreV1 = Math.round(valV1 * (1 + (Math.max(0, combo - 1) * Beatmap.difficultyMultiplier * Beatmap.modMultiplier) / 25) +
                headScore +
                tickScore +
                repeatScore +
                tailScore);
            const sliderScoreV2 = Math.round(valV2 * (1 + (Math.max(0, combo - 1) * Beatmap.difficultyMultiplier * Beatmap.modMultiplier) / 25) +
                headScore +
                tickScore +
                repeatScore +
                tailScore);
            if (valV1 === 300)
                accumulated.acc.V1.h300++;
            if (valV2 === 300)
                accumulated.acc.V2.h300++;
            if (valV1 === 100)
                accumulated.acc.V1.h100++;
            if (valV2 === 100)
                accumulated.acc.V2.h100++;
            if (valV1 === 50)
                accumulated.acc.V1.h50++;
            if (valV2 === 50)
                accumulated.acc.V2.h50++;
            if (valV1 === 0)
                accumulated.acc.V1.h0++;
            if (valV2 === 0)
                accumulated.acc.V2.h0++;
            this.comboPortion += valV2 * (1 + combo / 10);
            this.maxComboPortion += 300 * (1 + maxCombo / 10);
            // console.log(valV2)
            // console.log({ comboPortion: this.comboPortion, max: this.maxComboPortion })
            // if (valV1 !== valV2)
            //     console.log(hitData.time, valV1, valV2)
            return {
                V1: accumulated.V1 + sliderScoreV1,
                V1_S: accumulated.V1_S + sliderScoreV2,
                acc: accumulated.acc,
                bonus: accumulated.bonus,
                bonusV2: accumulated.bonusV2,
            };
        }, {
            V1: 0,
            V1_S: 0,
            acc: {
                V1: {
                    h300: 0,
                    h100: 0,
                    h50: 0,
                    h0: 0,
                },
                V2: {
                    h300: 0,
                    h100: 0,
                    h50: 0,
                    h0: 0,
                },
            },
            bonus: 0,
            bonusV2: 0,
        });
        const accV1 = (data.acc.V1.h300 + data.acc.V1.h100 / 3 + data.acc.V1.h50 / 6) /
            (data.acc.V1.h300 + data.acc.V1.h100 + data.acc.V1.h50 + data.acc.V1.h0);
        const accV2 = (data.acc.V2.h300 + data.acc.V2.h100 / 3 + data.acc.V2.h50 / 6) /
            (data.acc.V2.h300 + data.acc.V2.h100 + data.acc.V2.h50 + data.acc.V2.h0);
        const V2 = Math.round(700000 * (data.V1_S / Beatmap.maxScore) + 300000 * accV2 ** 10);
        const V2_new = Math.round(700000 * (this.comboPortion / this.maxComboPortion) + 300000 * (accV2 ** 10));
        // console.log(this.comboPortion)
        // console.log(this.maxComboPortion)
        // console.log(700000 * (this.comboPortion / this.maxComboPortion))
        console.log(`SCORE_V1 / MAX_SCORE_V1 RATIO:`.padEnd(30, " "), Fixed(data.V1 / Beatmap.maxScore * 100, 2));
        console.log(`COMBO_P / MAX_COMBO_P RATIO:`.padEnd(30, " "), Fixed(this.comboPortion / this.maxComboPortion * 100, 2));
        return {
            ...data,
            accV1,
            accV2,
            UR,
            V2,
            V2_new
        };
    }
    async calculate(printResult = true) {
        await this.readReplay();
        this.eval();
        const score = this.calculateScore();
        if (!printResult)
            return score;
        const calcDiff = (ScoreConverter.mods.includes("ScoreV2") ? score.V2_new + score.bonusV2 : score.V1 + score.bonus) - ScoreConverter.replayData.score;
        const expectedBonus = (ScoreConverter.mods.includes("ScoreV2") ? score.bonusV2 : score.bonus) - calcDiff;
        console.log(`MAX_COMBO:`.padEnd(15), ScoreConverter.maxCombo, "/", Beatmap.maxCombo);
        console.log(`ACC_V1:`.padEnd(15), Fixed(score.accV1 * 100, 2));
        console.log(`└─────`.padEnd(15, "─"), `\x1b[34m${score.acc.V1.h300} \x1b[0m/ \x1b[32m${score.acc.V1.h100} \x1b[0m/ \x1b[33m${score.acc.V1.h50} \x1b[0m/ \x1b[31m${score.acc.V1.h0}\x1b[0m`);
        console.log(`ACC_V2:`.padEnd(15), Fixed(score.accV2 * 100, 2));
        console.log(`└─────`.padEnd(15, "─"), `\x1b[34m${score.acc.V2.h300} \x1b[0m/ \x1b[32m${score.acc.V2.h100} \x1b[0m/ \x1b[33m${score.acc.V2.h50} \x1b[0m/ \x1b[31m${score.acc.V2.h0}\x1b[0m`);
        console.log(`UNSTABLE_RATE:`.padEnd(15), score.UR);
        console.log(`CALC_DIFF:`.padEnd(15), calcDiff);
        console.log(``.padEnd(30, "="));
        if (!ScoreConverter.mods.includes("ScoreV2")) {
            console.log(`SCORE_V1 (from replay):`.padEnd(50), ScoreConverter.replayData.score);
            console.log(`SCORE_V1 (calculated):`.padEnd(50), score.V1 + score.bonus);
            console.log(`SCORE_V1 (slider accuracy evaluated):`.padEnd(50), score.V1_S + score.bonus);
            console.log(`SCORE_V2 (old method):`.padEnd(50), Math.round(score.V2 * Beatmap.modMultiplier) + score.bonusV2);
            console.log(`SCORE_V2 (calculated):`.padEnd(50), Math.round(score.V2_new * Beatmap.modMultiplier) + score.bonusV2);
            console.log(`SPINNER_BONUS (expected):`.padEnd(50), expectedBonus);
            console.log(`SPINNER_BONUS (calculated):`.padEnd(50), score.bonus);
        }
        else {
            console.log(`SCORE_V1 (calculated):`.padEnd(50), score.V1 + score.bonus);
            console.log(`SCORE_V1 (slider accuracy evaluated):`.padEnd(50), score.V1_S + score.bonus);
            console.log(`SCORE_V2 (calculated):`.padEnd(50), Math.round(score.V2_new * Beatmap.modMultiplier) + score.bonusV2);
            console.log(`SCORE_V2 (from replay):`.padEnd(50), ScoreConverter.replayData.score);
            console.log(`SPINNER_BONUS (expected):`.padEnd(50), expectedBonus);
            console.log(`SPINNER_BONUS (calculated):`.padEnd(50), score.bonusV2);
        }
        return score;
    }
    constructor(buffer, local, content) {
        ScoreConverter.evalList = [];
        ScoreConverter.mods = [];
        ScoreConverter.isOldVersion = false;
        ScoreConverter.cursorInputData = [];
        ScoreConverter.maxCombo = 0;
        this.rawReplay = buffer;
        if (local && content) {
            this.localMap = true;
            this.rawMap = content;
        }
    }
}
