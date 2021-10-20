function selectColor(number) {
    const hue = number * 137.508; // use golden angle approximation
    return `hsl(${hue},50%,65%)`;
}

/**
 * Emulating https://docs.python.org/3.8/library/stdtypes.html#dict.setdefault
 * If key is in the dictionary, return its value.
 * If not, insert key with a value of default and return default. default defaults to None.
 * @param {*} key 
 * @param {*} default_value 
 */
 Map.prototype.setdefault = function (key, default_value=null) {
    if (!this.has(key)) {
        this.set(key, default_value);
    }
    return this.get(key);
}

function getNc(rule) {
    return (new Set([].concat.apply([], rule.map(r=>r.map(f=>{return Math.abs(f.color)}))))).size - 1;
}

function getNt(rule) {
    return rule.length;
}

function vectorAbs(v) {
    return new THREE.Vector3(
        Math.abs(v.x),
        Math.abs(v.y),
        Math.abs(v.z),
    );
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

function ruleToDec(rule) {
    return rule.map(s=>s.map((face,i)=>{
        if (face.color === 0) {
            return '';
        } else {
            let orientation = Math.round(getSignedAngle(faceRotations[i], face.alignDir, ruleOrder[i])*(2/Math.PI)+4)%4;
            return `${face.color}:${orientation}`;
        }
    }).join('|')).join('_');
}

function parseDecRule(ruleStr) {
    return ruleStr.split('_').map(s=>s.split('|').map((face,i)=>{
        let color = 0;
        let orientation = 0;
        if (face !== '') {
            [color, orientation] = face.split(':').map(v=>parseInt(v));
        }
        let r = faceRotations[i].clone();
        r.applyAxisAngle(ruleOrder[i], orientation*Math.PI/2).round();
        return {'color': color, 'alignDir': r};
    }))
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

function ruleToHex(rule) {
    const ruleSize = 6;
    let ruleStr = "";
    for (let i=0; i< rule.length; i++) {
        for (let j = 0; j<ruleSize; j++) {
            const face = rule[i][j];
            const sign = face.color < 0 ? "1" : "0";
            const color = Math.abs(face.color).toString(2).padStart(5,'0');
            let orientation = (getSignedAngle(faceRotations[j], face.alignDir, ruleOrder[j])*(2/Math.PI)+4)%4
            orientation = orientation.toString(2).padStart(2,'0');
            const binStr = sign + color + orientation;
            const hexStr = parseInt(binStr,2).toString(16).padStart(2,'0');
            ruleStr += hexStr;
        }
    }
    return ruleStr;
}

function getSignedAngle(v1, v2, axis) {
    let s = v1.clone().cross(v2);
    let c = v1.clone().dot(v2);
    let a = Math.atan2(s.length(), c);
    if (!s.equals(axis)) {
        a *= -1;
    }
    return a;
}


//https://stackoverflow.com/a/25199671
function rotateRule(rule, q) {
    const l=6;
    let newRule = Array(l);
    for (let i=0; i<l; i++) {
        let face = ruleOrder[i];
        let newFace = face.clone().applyQuaternion(q).round();
        let newFaceDir = rule[i].alignDir.clone().applyQuaternion(q).round();
        let iNewFace = ruleOrder.findIndex(
            function(element){return newFace.equals(element)
        });
        newRule[iNewFace] = {'color': rule[i].color, 'alignDir': newFaceDir};
    }
    return newRule;
}

//https://stackoverflow.com/a/25199671
function rotateRuleFromTo(rule, vFrom, vTo) {
    let quaternion = new THREE.Quaternion(); // create one and reuse it
    quaternion.setFromUnitVectors(vFrom, vTo);
    return rotateRule(rule, quaternion);
}

function rotateRuleAroundAxis(rule, axis, angle) {
    let quaternion = new THREE.Quaternion(); // create one and reuse it
    quaternion.setFromAxisAngle(axis, angle);
    return rotateRule(rule, quaternion);
}

// From stackoverflow/a/12646864
function shuffleArray(a) {
    for (let i = a.length -1; i>0; i--) {
     // let j = Math.floor(Math.random() * (i + 1));
        let j = Math.floor(Math.random() * (i+1));
        let temp = a[i];
        a[i] = a[j];
        a[j] = temp;
    }
}

function randOrdering(length) {
    let l = new Array(length);
    for (let i=0; i<length; i++) {
        l[i]=i;
    }
    shuffleArray(l);
    return l;
}

function getCoords(rule, assemblyMode='seeded') {
    let system = new PolycubeSystem(rule, undefined, 100, 100, assemblyMode);
    system.seed();
    while (!system.processMoves(true));
    return [...system.cubeMap.values()];
}

function getCubeTypeCount(hexRule, assemblyMode='seeded') {
    let rule = parseHexRule(hexRule);
    let sys = new PolycubeSystem(rule, undefined, 100, 100, assemblyMode);
    sys.seed();
    let processed = false;
    while (!processed) {
        processed = sys.processMoves();
        if (processed == 'oub') {
            console.warn("Getting cube type count for unbounded rule");
            break;
        }
    }
    return sys.cubeTypeCount;
}

function isBoundedAndDeterministic(rule, nTries=15, assemblyMode='seeded') {
    let oldCoords;
    while (nTries--) {
        let system = new PolycubeSystem(rule, undefined, 100, 100, assemblyMode);
        system.seed();
        let processed = false;
        while (!processed) {
            processed = system.processMoves();
            if (processed == 'oub') {
                return '∞';
            }
        }
        let strCoords = [...system.cubeMap.values()];
        if (oldCoords && !coordEqual(oldCoords, strCoords)) {
            return '?';
        }
        oldCoords = strCoords;
    }
    return true;
}

function simplify(rule) {
    let colors = new Set([].concat.apply([], rule.map(r=>r.map(f=>{return f.color}))));
    let newRule = [];
    rule.forEach((cubeType, iCube)=>{
        let allZero = true;
        cubeType.forEach((face, iFace)=>{
            let c = face.color
            if (!colors.has(c*-1)) {
                face.color = 0;
            }
            if (face.color == 0) {
                face.alignDir = faceRotations[iFace];
            }
            else {
                allZero = false;
            }
        })

        if (!allZero || iCube == 0) {
            newRule.push(cubeType);
        }
    });

    let colorset = Array.from(new Set([].concat.apply([], rule.map(r=>r.map(f=>{return Math.abs(f.color)}))))).filter(x => x != 0)
    newRule.forEach(cubeType=>{
        cubeType.forEach(face=>{
            c = face.color;
            if (c != 0) {
                face.color = colorset.indexOf(Math.abs(c)) + 1;
                if (c < 0) {
                    face.color *= -1;
                }
            }
        })
    })
    return newRule;
}

function simplify2(rule, onUpdate) {
    rule = simplify(rule);

    let correctCoords = getCoords(rule);

    const rotations = allRotations().map(
        r=>[r,new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().setFromMatrix3(r))]
    );

    let alreadyTried = new Set();
    let triedStr = (a,b)=>`${[a,b].sort()}`;

    let updatedRuleset = true;
    while (updatedRuleset) {
        updatedRuleset = false;
        for (const [iA, cA] of rule.entries()) {
            const coordsA = getPatchCoords(cA);
            for (const [iB, cB] of rule.entries()) {
                if (iA < iB) {
                    const coordsB = getPatchCoords(cB);
                    // If they have the same number of patches
                    if (coordsA.length === coordsB.length && !alreadyTried.has(triedStr(iA,iB))) {
                        for (const [r,q] of rotations) {
                            if (compCols(coordsA, rotCoords(coordsB, r))) {
                                console.log(`Cube type ${iA} is similar to ${iB}`);
                                let colorMap = new Map();
                                //let rotMap = new Map();
                                //const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().setFromMatrix3(r));
                                const rotatedB = rotateRule(cB, q);
                                for (let i=0; i<6; i++) {
                                    if (rotatedB[i].color !== 0) {
                                        console.assert(cA[i].color !== 0);
                                        colorMap.set(rotatedB[i].color, cA[i].color);
                                        //rotMap.set(rotatedB[i].color, getSignedAngle(cB[i].alignDir, cA[i].alignDir, ruleOrder[i]));
                                    }
                                }
                                let newRule = [];
                                // Clone rule and create new ruleset
                                parseDecRule(ruleToDec(rule)).forEach((c,i)=>{
                                    if (i !== iB) {
                                        c.forEach((p,i)=>{
                                            // Replace all of the old color with the new
                                            const color = p.color;
                                            if(colorMap.has(color)) {
                                                p.color = colorMap.get(color);
                                                p.alignDir = cA[i].alignDir;
                                            }
                                            else if(colorMap.has(-color)) {
                                                p.color = -colorMap.get(-color);
                                                p.alignDir.applyQuaternion(q.invert());
                                            }
                                        });
                                    } else {
                                        c.forEach((p,i)=>{
                                            p.color = 0;
                                            p.alignDir = faceRotations[i];
                                        })
                                    }
                                    newRule.push(c);
                                });

                                const simplifiedNewRule = simplify(newRule); //remove empty slots

                                // Accept new ruleset if we still get the same chape
                                if (
                                    (isBoundedAndDeterministic(simplifiedNewRule, undefined, 'seeded') === true) &&
                                    coordEqual(getCoords(simplifiedNewRule, 'seeded'), correctCoords)
                                ) {
                                    updatedRuleset = true;
                                    rule = newRule;
                                    console.log(`Changing  ${iB} to ${iA} did work: ${ruleToDec(simplifiedNewRule)}`);
                                    alreadyTried.add(triedStr(iA,iB));
                                    if (onUpdate) {
                                        onUpdate(ruleToDec(simplifiedNewRule));
                                    }
                                    break;
                                } else {
                                    console.log(`Changing  ${iB} to ${iA} did not work: ${ruleToDec(simplifiedNewRule)}\nBounded & Deterministic = ${isBoundedAndDeterministic(simplifiedNewRule)}\nEqual coords = ${coordEqual(getCoords(simplifiedNewRule), correctCoords)}`);
                                    alreadyTried.add(triedStr(iA,iB));
                                    //break;
                                }
                            }
                        }
                    }
                }
                if (updatedRuleset) {
                    break;
                }
            }
            if (updatedRuleset) {
                break;
            }
        }
    }
    return simplify(rule);
}

function getPatchCoords(cube) {
    let coords = [];
    cube.forEach((f,i)=>{
        if (f.color !== 0) {
            coords.push(ruleOrder[i]);
        }
    });
    return coords;
}

function patchCount(cube) {
    return cube.filter(face=>face.color!=0).length;
}

function getCenterOfMass(coords) {
    let tot = new THREE.Vector3();
    coords.forEach(c=>tot.add(c));
    tot.divideScalar(coords.length)
    return tot;
}

function rotCoords(coords, r) {
    return coords.map(c=>c.clone().applyMatrix3(r));
}

function coordEqual(coordsA, coordsB) {
    // Copy coords so as not to modify originals
    let cA = coordsA.map(c=>c.clone());
    let cB = coordsB.map(c=>c.clone());

    if (cA.length != cB.length) {
        console.log(`Coords not equal (different lengths)`);
        return false;
    }
    let comA = getCenterOfMass(cA).round();
    let comB = getCenterOfMass(cB).round();
    cA.forEach(c=>c.sub(comA));
    cB.forEach(c=>c.sub(comB));

    for (const r of allRotations()) {
        if (compCols(cA, rotCoords(cB, r))) {
            return true;
        }
    }
    console.log(`Coords not equal (Could not find fitting rotation)`);
    return false;
}

// Compare matrices, ignoring column order
function compCols(coordsA, coordsB) {
    console.assert(coordsA.length == coordsB.length);

    let s1 = new Set(coordsA.map(c=>c.toArray().toString()));
    let s2 = new Set(coordsB.map(c=>c.toArray().toString()));

    // Check if sets are equal
    if (s1.size !== s2.size) return false;
    for (const c of s1) {
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
    ];
}