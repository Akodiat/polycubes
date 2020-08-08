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

function saveString(text, filename) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
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

class PolycubeSystem {

    constructor(rules, ruleOrder, nMaxCubes=1000, maxCoord=100) {
        this.moves = {};
        this.moveKeys = [];
        this.cubeMap = new Map();
        this.centerOfMass = new THREE.Vector3();
        this.nMaxCubes = nMaxCubes;
        this.maxCoord = maxCoord;

        this.colorMaterials = [];
        this.particleMaterials = [];
        this.matches = 0;
        this.mismatches = 0;

        this.objGroup = new THREE.Group();
        scene.add(this.objGroup);

        this.ruleOrder = ruleOrder;
        this.rule = rules;
        let nColors = Math.max.apply(Math, rules.map(x => Math.max.apply(
            Math, x.map(r => Math.abs(r.color))))
        );
        nColors = Math.max(nColors, 2) //Avoid getting only red colors

        let connectionColors = randomColor({luminosity: 'light', count: nColors, seed: 1});
        for (let i=0; i<nColors; i++) {
            let colorMaterial = new THREE.MeshLambertMaterial({color: connectionColors[i]});
                this.colorMaterials.push(colorMaterial);
        }

        let particleColors = randomColor({luminosity: 'light',  hue: 'monochrome', count: rules.length, seed: 1});
        for (let i=0; i<rules.length; i++) {
            let cubeMaterial = new THREE.MeshStandardMaterial({color: particleColors[i]});
                this.particleMaterials.push(cubeMaterial);
        }

        let centerCubeSize = 0.7;
        let connectorCubeSize = (1-centerCubeSize);
        this.connectorCubeGeo = new THREE.BoxBufferGeometry(
            connectorCubeSize, connectorCubeSize, connectorCubeSize
        );
        this.connectorPointerGeo = new THREE.BoxBufferGeometry(
            connectorCubeSize/2, connectorCubeSize/2, connectorCubeSize/2
        );
        this.centerCubeGeo = new THREE.BoxBufferGeometry(
            centerCubeSize, centerCubeSize, centerCubeSize
        );

        document.addEventListener("keydown", event => {
            if (event.key == 's' && event.ctrlKey) {
                event.preventDefault();
                this.getCoordinateFile();
            }
        });
    }

    isPolycubeSystem() {
        return true;
    }

    reset() {
        objects = objects.filter(function(e) { return e.name !== "Cube" })
        this.objGroup.children = [];
        this.moves = {};
        this.moveKeys = [];
        this.cubeMap = new Map();
        this.matches = 0;
        this.mismatches = 0;
        render();
    }

    resetRandom() {
        let maxRuleSize = 8;
        let ruleSize = Math.round(Math.random()*maxRuleSize)+1;
        let hexRule = "";
        while(ruleSize--) {
            hexRule += (Math.abs(Math.random()*0xFFFFFFFFFFFF<<0)).toString(16);
        }
        let argstr = "?hexRule="+hexRule;
        window.history.pushState(null, null, argstr);
        this.resetRule(parseHexRule(hexRule));
    }

    resetRule(rules) {
        this.reset();
        this.rule = rules;

        let nColors = Math.max.apply(Math, rules.map(x => Math.max.apply(
            Math, x.map(r => Math.abs(r.color))))
        );
        nColors = Math.max(nColors, 2) //Avoid getting only red colors

        for (let i=0; i<nColors; i++) {
            let colorMaterial = new THREE.MeshLambertMaterial({
                color: randomColor({luminosity: 'light'})
            });
            this.colorMaterials.push(colorMaterial);
        }

        for (let i=0; i<rules.length; i++) {
            let cubeMaterial = new THREE.MeshLambertMaterial({
                color: randomColor({luminosity: 'light',  hue: 'monochrome'})
            });
            this.particleMaterials.push(cubeMaterial);
        }

        this.addParticle(new THREE.Vector3(), rules[0], 0);

        this.processMoves();
        render();
    }

    getMismatchRatio() {
        return this.mismatches / (this.matches + this.mismatches)
    }

    getRuleStr() {
        let ruleSize = 6;
        let ruleStr = "";
        for (let i=0; i< this.rule.length; i++) {
            for (let j = 0; j<ruleSize; j++) {
                let face = this.rule[i][j];
                let sign = face.color < 0 ? "1" : "0";
                let color = Math.abs(face.color).toString(2).padStart(5,'0');
                let orientation = (this.getSignedAngle(faceRotations[j], face.alignDir, ruleOrder[j])*(2/Math.PI)+4)%4
                //let orientation = face.alignDir.angleTo(faceRotations[j])*(2/Math.PI);
                orientation = orientation.toString(2).padStart(2,'0');
                let binStr = sign + color + orientation;
                let hexStr = parseInt(binStr,2).toString(16).padStart(2,'0');
                ruleStr += hexStr;
            }
        }
        return ruleStr;
    }

    getCoordinateFile() {
        let filename = `${this.getRuleStr()}.${this.cubeMap.size}-mer`;
        let text = ""
        this.cubeMap.forEach(function(value, key){text += key + '\n'});
        saveString(text, filename);
    }

    exportGLTF() {
        // Instantiate an exporter
        let exporter = new THREE.GLTFExporter();
        let options = {'forceIndices': true};

        // Parse the input and generate the glTF output
        exporter.parse(objects, function (result) {
            if (result instanceof ArrayBuffer) {
                saveArrayBuffer(result, 'scene.glb');
            } else {
                let output = JSON.stringify(result, null, 2);
                console.log(output);
                saveString(output, 'scene.gltf');
            }
        }, options);
    }

    ruleFits(a,b) {
        let l = a.length;
        // Traverse rule faces in random order
        let ra = this.randOrdering(l);
        let rb = this.randOrdering(l);
        // For each face in rule a...
        for (let ria=0; ria<l; ria++) {
            let i = ra[ria];
            // ...that is non-zero
            if (a[i] && a[i].color != 0) {
                // Check each face in rule b
                for (let rib=0; rib<l; rib++) {
                    let j = rb[rib];
                    // If we find an equal color
                    if (a[i].color == b[j].color) {
                        // Rotate rule b so that the matching face has
                        // the same direction:
                        b = this.rotateRuleFromTo(b, 
                            this.ruleOrder[j],
                            this.ruleOrder[i]);
                        console.assert(a[i].color == b[i].color);
                        // ...and the same rotation:
                        b = this.rotateRuleAroundAxis(b, 
                            this.ruleOrder[i],
                           -this.getSignedAngle(a[i].alignDir, b[i].alignDir,
                            this.ruleOrder[i]));
                        console.assert(a[i].color == b[i].color);
                        // Return the rotated rule b
                        return b;
                    }
                }
            }
        }
        // Return false if we didn't find any matching faces
        return false;
    }

    getSignedAngle(v1, v2, axis) {
        let s = v1.clone().cross(v2);
        let c = v1.clone().dot(v2);
        let a = Math.atan2(s.length(), c);
        if (!s.equals(axis)) {
            a *= -1;
        }
        return a;
    }


    //https://stackoverflow.com/a/25199671
    rotateRule(rule, q) {
        let l=6;
        let newRule = Array(l);
        for (let i=0; i<l; i++) {
            let face = this.ruleOrder[i];
            let newFace = face.clone().applyQuaternion(q).round();
            let newFaceDir = rule[i].alignDir.clone().applyQuaternion(q).round();
            let iNewFace = this.ruleOrder.findIndex(
                function(element){return newFace.equals(element)
            });
            newRule[iNewFace] = {'color': rule[i].color, 'alignDir': newFaceDir};
        }
        return newRule;
    }
    //https://stackoverflow.com/a/25199671
    rotateRuleFromTo(rule, vFrom, vTo) {
        let quaternion = new THREE.Quaternion(); // create one and reuse it
        quaternion.setFromUnitVectors(vFrom, vTo);
        return this.rotateRule(rule, quaternion);
    }
    rotateRuleAroundAxis(rule, axis, angle) {
        let quaternion = new THREE.Quaternion(); // create one and reuse it
        quaternion.setFromAxisAngle(axis, angle);
        return this.rotateRule(rule, quaternion);
    }

    // From stackoverflow/a/12646864
    shuffleArray(a) {
        for (let i = a.length -1; i>0; i--) {
         // let j = Math.floor(Math.random() * (i + 1));
            let j = Math.floor(Math.random() * (i+1));
            let temp = a[i];
            a[i] = a[j];
            a[j] = temp;
        }
    }

    randOrdering(length) {
        let l = new Array(length);
        for (let i=0; i<length; i++) {
            l[i]=i;
        }
        this.shuffleArray(l);
        return l;
    }

    processMoves() {
        let nMoves = this.moveKeys.length;
        if (nMoves > 0) { // While we have moves to process
            // Pick a random move
            let key = this.moveKeys[Math.floor(Math.random()*nMoves)];

            // Pick a random rule order
            let ruleIdxs = this.randOrdering(this.rule.length);
            // Check if we have a rule that fits this move
            for (let r=0; r<this.rule.length; r++) {
                let rule = this.rule[ruleIdxs[r]];
                rule = this.ruleFits(this.moves[key].rule, rule);
                if(rule) {
                    for (let i=0; i<rule.length; i++) {
                        let neigb = this.moves[key].rule[i]
                        if (neigb != null) {
                            if (neigb.color == rule[i].color && neigb.alignDir.equals(rule[i].alignDir)) {
                                this.matches++;
                            } else {
                                this.mismatches++;
                            }
                        }
                    }
                    this.addParticle(this.moves[key].pos, rule, ruleIdxs[r]);
                    if (this.cubeMap.size >= this.nMaxCubes) {
                        render();
                        window.dispatchEvent(new Event('oub'));
                        console.log("Unbounded");
                        return;
                    }
                    break;
                }
            }
            // Remove processed move
            delete this.moves[key];
            this.moveKeys.splice(this.moveKeys.indexOf(key), 1);
        } else {
            window.dispatchEvent(new Event('movesProcessed'));
            console.log("Moves processed");
            return;
        }
        //render();
        requestAnimationFrame(this.processMoves.bind(this));
    }

    //Need both rule and ruleIdx to determine color as the rule might be rotated
    addParticle(position, rule, ruleIdx) {
        // Go through all non-zero parts of the rule and add potential moves
        let potentialMoves = [];
        for (let i=0; i<rule.length; i++) {
            if (rule[i].color == 0) {
                continue;
            }
            let movePos = position.clone().add(this.ruleOrder[i])
            if (Math.abs(movePos.x)>this.maxCoord ||
               Math.abs(movePos.y)>this.maxCoord ||
               Math.abs(movePos.z)>this.maxCoord)
            {
                // Neigbour outside of bounding box, stopping here
                continue;
            }
            let key = vecToStr(movePos);
            if (this.cubeMap.has(key)) {
                // There is already a cube at pos,
                // no need to add this neigbour to moves
                continue
            }

            if (!(key in this.moves)) {
                this.moves[key] = {
                    'pos': movePos,
                    'rule': [null,null,null,null,null,null]};
                this.moveKeys.push(key);
            }
            let r = position.clone().sub(movePos);
            let dirIdx = this.ruleOrder.findIndex(
                function(element){return r.equals(element)}
            );

            //Make sure we haven't written anything here before:
            if (this.moves[key].rule[dirIdx]) {
                return;
            }


            potentialMoves.push({
                'key': key,
                'dirIdx': dirIdx,
                'color': rule[i].color*-1,
                'alignDir': rule[i].alignDir
            });
        }
        potentialMoves.forEach(i => {
            this.moves[i.key].rule[i.dirIdx] = {'color': i.color, 'alignDir': i.alignDir};
        });

        this.drawCube(position, rule, ruleIdx);

        this.centerOfMass.multiplyScalar(this.cubeMap.size);
        this.centerOfMass.add(position);
        this.cubeMap.set(vecToStr(position), true);
        this.centerOfMass.divideScalar(this.cubeMap.size);

        render();
    }

    drawCube(position, rule, ruleIdx) {
        let cube = new THREE.Group();
        let centerCube = new THREE.Mesh(
            this.centerCubeGeo, this.particleMaterials[ruleIdx]);
        cube.add(centerCube);
        for (let j=0; j<rule.length; j++) {
            if (rule[j].color != 0) {
                let material = this.colorMaterials[Math.abs(rule[j].color) - 1].clone();
                if (rule[j].color >= 0) {
                    material.emissive = material.color.clone().addScalar(-0.5);
                }
                let connectorCube = new THREE.Mesh(
                    this.connectorCubeGeo, material
                );
                connectorCube.position.add(
                    this.ruleOrder[j].clone().multiplyScalar(0.3)
                );
                let connectorPointer = new THREE.Mesh(
                    this.connectorPointerGeo, material
                );
                connectorPointer.position.copy(connectorCube.position);
                connectorPointer.position.add(rule[j].alignDir.clone().multiplyScalar(0.2));
                cube.add(connectorCube);
                cube.add(connectorPointer);
            }
        }
        cube.position.copy(position);
        cube.name = "Cube";
        this.objGroup.add(cube);
        objects.push(cube);
    }

}
