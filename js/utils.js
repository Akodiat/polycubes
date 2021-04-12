function selectColor(number) {
    const hue = number * 137.508; // use golden angle approximation
    return `hsl(${hue},50%,65%)`;
}

function saveString(text, filename) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

let ruleOrder = [
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3( 1, 0, 0),
    new THREE.Vector3( 0,-1, 0),
    new THREE.Vector3( 0, 1, 0),
    new THREE.Vector3( 0, 0,-1),
    new THREE.Vector3( 0, 0, 1),
]

let faceRotations = [
    new THREE.Vector3( 0,-1, 0),
    new THREE.Vector3( 0, 1, 0),
    new THREE.Vector3( 0, 0,-1),
    new THREE.Vector3( 0, 0, 1),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3( 1, 0, 0),
];

function vecToStr(v) {
    return `(${v.x},${v.y},${v.z})`;
}

// https://stackoverflow.com/a/45054052
function parseHexRule(ruleStr) {
    let ruleSize = 6;
    let rules = [];
    for (let i=0; i<ruleStr.length; i+=2*ruleSize) {
        let rule = [];
        //console.log("Rule ",(i/(2*ruleSize))+1);
        for (let j = 0; j<ruleSize; j++) {
            let face = ruleStr.substring(i+(2*j), i+(2*j) + 2);
            let binStr = (parseInt(face, 16).toString(2)).padStart(8, '0');
            let sign = parseInt(binStr[0], 2);
            let color = parseInt(binStr.substring(1,6),2);
            let orientation = parseInt(binStr.substring(6,8),2);

            let r = faceRotations[j].clone();
            r.applyAxisAngle(ruleOrder[j], orientation*Math.PI/2);
            r.round();
            rule.push( {'color': color * (sign ? -1:1), 'alignDir': r} );
        }
        rules.push(rule);
    }
    return rules;
}

function isBoundedAndDeterministic(hexRule, nTries=15, assemblyMode='seeded') {
    let rule = parseHexRule(hexRule);
    let oldCoords;
    while (nTries--) {
        system = new PolycubeSystem(rule, ruleOrder, undefined, 100, 100, assemblyMode);
        system.seed();
        let processed = false;
        while (!processed) {
            processed = system.processMoves(true); //process move in background, without animation
            if (processed == 'oub') {
                return '∞';
            }
        }
        //let strCoords = [...system.cubeMap.values()]
        //if (oldCoords && !coordEqual(oldCoords, strCoords)) {
        let strCoords = [...system.cubeMap.keys()].sort().join('\n');
        if (oldCoords && (oldCoords != strCoords)) {
            return '?';
        }
        oldCoords = strCoords;
    }
    return true;
}

function getCenterOfMass(coords) {
    let tot = new THREE.Vector3();
    coords.forEach(c=>tot.add(c));
    return tot.divideScalar(coords.length);
}

function rotCoords(coords, r) {
    let rotatedCoords = []
    coords.forEach(c=>{
        rotatedCoords.push(c.clone().applyMatrix3(r));
    })
    return rotatedCoords;
}

function coordEqual(coordsA, coordsB) {
    if (coordsA.length != coordsB.length) {
        return false;
    }
    let comA = getCenterOfMass(coordsA);
    let comB = getCenterOfMass(coordsB);
    coordsA.forEach(c=>c.sub(comA));
    coordsB.forEach(c=>c.sub(comB));

    for (var r of allRotations()) {
        if (compCols(coordsA, rotCoords(coordsB, r))) {
            return true;
        }
    }
    return false;
}

// Compare matrices, ignoring column order
function compCols(coordsA, coordsB) {
    console.assert(coordsA.length == coordsB.length);

    let s1 = new Set(coordsA.map(c=>c.toArray().toString()));
    let s2 = new Set(coordsB.map(c=>c.toArray().toString()));

    if (s1.size !== s2.size) return false;
    for (var c of s1) {
        if (!s2.has(c)) {
            return false;
        }
    }
    return true;
}

function allRotations() {
    return [
        new THREE.Matrix3().set(1, 0, 0, 0, 1, 0, 0, 0, 1),
        new THREE.Matrix3().set(0, -1, 0, 1, 0, 0, 0, 0, 1),
        new THREE.Matrix3().set(-1, 0, 0, 0, -1, 0, 0, 0, 1),
        new THREE.Matrix3().set(0, 1, 0, -1, 0, 0, 0, 0, 1),
        new THREE.Matrix3().set(0, 0, 1, 0, 1, 0, -1, 0, 0),
        new THREE.Matrix3().set(-1, 0, 0, 0, 1, 0, 0, 0, -1),
        new THREE.Matrix3().set(0, 0, -1, 0, 1, 0, 1, 0, 0),
        new THREE.Matrix3().set(1, 0, 0, 0, 0, -1, 0, 1, 0),
        new THREE.Matrix3().set(1, 0, 0, 0, -1, 0, 0, 0, -1),
        new THREE.Matrix3().set(1, 0, 0, 0, 0, 1, 0, -1, 0),
        new THREE.Matrix3().set(0, -1, 0, 0, 0, 1, -1, 0, 0),
        new THREE.Matrix3().set(0, -1, 0, -1, 0, 0, 0, 0, -1),
        new THREE.Matrix3().set(0, -1, 0, 0, 0, -1, 1, 0, 0),
        new THREE.Matrix3().set(0, 0, 1, 1, 0, 0, 0, 1, 0),
        new THREE.Matrix3().set(0, 1, 0, 1, 0, 0, 0, 0, -1),
        new THREE.Matrix3().set(0, 0, -1, 1, 0, 0, 0, -1, 0),
        new THREE.Matrix3().set(0, 0, -1, 0, -1, 0, -1, 0, 0),
        new THREE.Matrix3().set(0, 0, 1, 0, -1, 0, 1, 0, 0),
        new THREE.Matrix3().set(-1, 0, 0, 0, 0, 1, 0, 1, 0),
        new THREE.Matrix3().set(-1, 0, 0, 0, 0, -1, 0, -1, 0),
        new THREE.Matrix3().set(0, 1, 0, 0, 0, -1, -1, 0, 0),
        new THREE.Matrix3().set(0, 1, 0, 0, 0, 1, 1, 0, 0),
        new THREE.Matrix3().set(0, 0, -1, -1, 0, 0, 0, 1, 0),
        new THREE.Matrix3().set(0, 0, 1, -1, 0, 0, 0, -1, 0)
    ]
}