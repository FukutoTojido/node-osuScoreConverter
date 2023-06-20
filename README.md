# node-osuScoreConverter
Tool to calculate ScoreV2 from replay ScoreV1 and vice versa.
Disclaimer: This tool does not guarantee a 100% conversion. You are always welcome to contribute to this repository :) 

## Usage
```js
import ScoreConverter from "./dist/index.js";
import fs from "fs"

const Test = async (path) => {
    const buf = fs.readFileSync(path);
    const score = new ScoreConverter(buf);
    const data = await score.calculate();
}

Test("./replays/hrmc.osr");
```

## Output
```
MAX_COMBO:      1878 / 1879
ACC_V1:         99.66
└────────────── 1350 / 7 / 0 / 0
ACC_V2:         99.61
└────────────── 1349 / 8 / 0 / 0
UNSTABLE_RATE:  99.59
CALC_DIFF:      0
==============================
SCORE_V1 (from replay):                            61779134
SCORE_V1 (calculated):                             61779134
SCORE_V1 (slider accuracy evaluated):              61734294
SCORE_V2 (slider accuracy evaluated):              985313
SPINNER_BONUS (expected):                          10000
SPINNER_BONUS (calculated):                        10000
```