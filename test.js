import ScoreConverter from "./dist/index.js";
import fs from "fs";

const Test = async (path) => {
    const buf = fs.readFileSync(path);
    const score = new ScoreConverter(buf);
    const data = await score.calculate();
}

// Test("./replays/drastic.osr");
// Test("./replays/arisa.osr");
// Test("./replays/restart.osr");
// Test("./replays/rainbow.osr");
// Test("./replays/storyteller.osr");
// Test("./replays/uma.osr");
// Test("./replays/uma2.osr");

// Fucking osu! old slider type
// Test("./replays/KIRBYMIX.osr");

// Test("./replays/UN.osr");
Test("./replays/dt1.osr");

// (async () => {
//     await Test("./replays/restart.osr");
//     await Test("./replays/drastic.osr");
//     await Test("./replays/rainbow.osr");
// })();

const TestLocal = async (replayPath, mapPath) => {
    const buf = fs.readFileSync(replayPath);
    const map = fs.readFileSync(mapPath, 'utf-8');
    const score = new ScoreConverter(buf, true, map);
    const data = await score.calculate();
}

// TestLocal("./replays/local3.osr", "./maps/test7.osu")

