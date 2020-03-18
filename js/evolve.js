function initFrame(frame) {
    let window = frame.contentWindow;
    window.polycubeSystem.resetRule(window.parseHexRule(randomRule()));
    window.document.ondblclick = ()=>{
        let hex = window.polycubeSystem.getHexRule();
        let frames = document.getElementById("grid").children;
        for (let i=0; i<frames.length; i++) {
            if(frames[i] != frame) {
                let w = frames[i].contentWindow;
                let newRule = mutateRule(hex);
                w.polycubeSystem.resetRule(w.parseHexRule(newRule));
            }
            else {
                console.log(`Selected #${i} with rule ${hex}`);
            }
        }
    }
}

function randomUrl() {
    return "view.html?hexRule="+randomRule();
}

function randomRule() {
    var maxRuleSize = 8;
    var ruleSize = Math.round(Math.random()*maxRuleSize)+1;
    var hexRule = "";
    while(ruleSize--) {
        hexRule += (Math.abs(Math.random()*0xFFFFFFFFFFFF<<0)).toString(16);
    }
    return hexRule;
}

function hex2bin(hex){
    let bin = "";
    for(let i=0; i<hex.length; i++) {
        bin += (parseInt(hex[i], 16).toString(2)).padStart(4, '0');
    }
    return bin;
}

function bin2hex(bin){
    return splitEveryN(bin, 4).map(b=>{
        return (parseInt(b, 2).toString(16));
    }).join('');
}

//https://stackoverflow.com/a/12686829
function splitEveryN(str, n) {
    return str.match(new RegExp('.{1,' + n + '}', 'g'));
}

function flipBitAt(bin, i) {
    let b = bin[i];
    b = (b == '1' ? '0':'1');
    return bin.substring(0, i) + b + bin.substring(i + 1);
}

function insertBitAt(bin, i) {
    let b = Math.round(Math.random());
    return bin.substring(0, i) + b + bin.substring(i);
}

function removeBitAt(bin, i) {
    return bin.substring(0, i) + bin.substring(i + 1);
}

function mutateRule(hexRule) {
    let bin = hex2bin(hexRule);
    let iRand = ()=> {return Math.floor(Math.random() * bin.length)};
    
    let pFlip = 0.5;
    let pInsert = 0.5;
    let pRemove = 0.5;
    
    if (Math.random() < pFlip) bin = flipBitAt(bin, iRand());
    if (Math.random() < pInsert) bin = insertBitAt(bin, iRand());
    if (Math.random() < pRemove) bin = removeBitAt(bin, iRand());
    
    return bin2hex(bin);
}

