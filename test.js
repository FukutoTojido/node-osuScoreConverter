import ScoreConverter from "./dist/index.js";
import fs from "fs";

const Test = async (path) => {
    const buf = fs.readFileSync(path);
    const score = new ScoreConverter(buf);
    const data = await score.calculate();
}

Test("./replays/hrmc.osr");
