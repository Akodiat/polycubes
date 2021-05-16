importScripts(
    '../../js/libs/three.min.js',
    '../../js/libs/randomColor.min.js',
    '../../js/utils.js',
    '../../js/polycubeSystem.js'
);

onmessage = function(e) {
    let inputRule = parseHexRule(e.data);
    let result = ruleToHex(simplify2(inputRule, rule=>postMessage(rule)));
    console.log("Got result: "+result);
    postMessage(result);
}