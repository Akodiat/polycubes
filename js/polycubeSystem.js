var ruleOrder = [
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3( 1, 0, 0),
    new THREE.Vector3( 0,-1, 0),
    new THREE.Vector3( 0, 1, 0),
    new THREE.Vector3( 0, 0,-1),
    new THREE.Vector3( 0, 0, 1),
]

var faceRotations = [
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
    var ruleSize = 6;
    var rules = [];
    for (var i=0; i<ruleStr.length; i+=2*ruleSize) {
        var rule = [];
        console.log("Rule ",(i/(2*ruleSize))+1);
        for (var j = 0; j<ruleSize; j++) {
            var face = ruleStr.substring(i+(2*j), i+(2*j) + 2);
            var binStr = (parseInt(face, 16).toString(2)).padStart(8, '0');
            var sign = parseInt(binStr[0], 2);
            var color = parseInt(binStr.substring(1,6),2);
            var orientation = parseInt(binStr.substring(6,8),2);

            var r = faceRotations[j].clone();
            r.applyAxisAngle(ruleOrder[j], orientation*Math.PI/2);
            r.round();
            rule.push( {'c': color * (sign ? -1:1), 'd': r} );
        }
        rules.push(rule);
    }
    return rules;
}

class PolycubeSystem {

    constructor(rules, ruleOrder, nMaxCubes=1000, maxCoord=50) {
        this.moves = {};
        this.moveKeys = [];
        this.cubeMap = new Map();
        this.centerOfMass = new THREE.Vector3();
        this.nMaxCubes = nMaxCubes;
        this.maxCoord = maxCoord;

        this.colorMaterials = [];
        this.cubeMaterials = [];
        this.matches = 0;
        this.mismatches = 0;

        this.bgColor = scene.background;

        this.ruleOrder = ruleOrder;
        this.rules = rules;
        var nColors = Math.max.apply(Math, rules.map(x => Math.max.apply(
            Math, x.map(r => Math.abs(r.c))))
        );
        nColors = Math.max(nColors, 2) //Avoid getting only red colors

        for (var i=0; i<nColors; i++) {
            var colorMaterial = new THREE.MeshLambertMaterial({
                color: randomColor({luminosity: 'light'})
            });
            this.colorMaterials.push(colorMaterial);
        }

        for (var i=0; i<rules.length; i++) {
            var cubeMaterial = new THREE.MeshLambertMaterial({
                color: randomColor({luminosity: 'light',  hue: 'monochrome'})
            });
            this.cubeMaterials.push(cubeMaterial);
        }

        var centerCubeSize = 0.7;
        var connectorCubeSize = (1-centerCubeSize);
        this.connectorCubeGeo = new THREE.BoxBufferGeometry(
            connectorCubeSize, connectorCubeSize, connectorCubeSize
        );
        this.connectorPointerGeo = new THREE.BoxBufferGeometry(
            connectorCubeSize/2, connectorCubeSize/2, connectorCubeSize/2
        );
        this.centerCubeGeo = new THREE.BoxBufferGeometry(
            centerCubeSize, centerCubeSize, centerCubeSize
        );
    }

    reset() {
        objects = objects.filter(function(e) { return e.name !== "Cube" })
        scene.children = scene.children.filter(function(e) { return e.name !== "Cube" })
        scene.background = this.bgColor;
        this.moves = {};
        this.moveKeys = [];
        this.cubeMap = new Map();
        this.matches = 0;
        this.mismatches = 0;
        render();
    }

    resetRule(rules) {
        this.reset();
        this.rules = rules;

        var nColors = Math.max.apply(Math, rules.map(x => Math.max.apply(
            Math, x.map(r => Math.abs(r.c))))
        );
        nColors = Math.max(nColors, 2) //Avoid getting only red colors

        for (var i=0; i<nColors; i++) {
            var colorMaterial = new THREE.MeshLambertMaterial({
                color: randomColor({luminosity: 'light'})
            });
            this.colorMaterials.push(colorMaterial);
        }

        for (var i=0; i<rules.length; i++) {
            var cubeMaterial = new THREE.MeshLambertMaterial({
                color: randomColor({luminosity: 'light',  hue: 'monochrome'})
            });
            this.cubeMaterials.push(cubeMaterial);
        }

        this.addCube(new THREE.Vector3(), rules[0], 0);

        this.processMoves();
        render();
    }

    getMismatchRatio() {
        return this.mismatches / (this.matches + this.mismatches)
    }

    getHexRule() {
        var ruleSize = 6;
        var ruleStr = "";
        for (var i=0; i< this.rules.length; i++) {
            for (var j = 0; j<ruleSize; j++) {
                var face = this.rules[i][j];
                var sign = face.c < 0 ? "1" : "0";
                var color = Math.abs(face.c).toString(2).padStart(5,'0');
                var orientation = (this.getSignedAngle(faceRotations[j], face.d, ruleOrder[j])*(2/Math.PI)+4)%4
                //var orientation = face.d.angleTo(faceRotations[j])*(2/Math.PI);
                orientation = orientation.toString(2).padStart(2,'0');
                var binStr = sign + color + orientation;
                var hexStr = parseInt(binStr,2).toString(16).padStart(2,'0');
                ruleStr += hexStr;
            }
        }
        return ruleStr;

    }

    ruleFits(a,b) {
        var l = a.length;
        // Traverse rule faces in random order
        var ra = this.randOrdering(l);
        var rb = this.randOrdering(l);
        // For each face in rule a...
        for (var ria=0; ria<l; ria++) {
            var i = ra[ria];
            // ...that is non-zero
            if (a[i] && a[i].c != 0) {
                // Check each face in rule b
                for (var rib=0; rib<l; rib++) {
                    var j = rb[rib];
                    // If we find an equal color
                    if (a[i].c == b[j].c) {
                        // Rotate rule b so that the matching face has
                        // the same direction:
                        b = this.rotateRuleFromTo(b, 
                            this.ruleOrder[j],
                            this.ruleOrder[i]);
                        console.assert(a[i].c == b[i].c);
                        // ...and the same rotation:
                        b = this.rotateRuleAroundAxis(b, 
                            this.ruleOrder[i],
                           -this.getSignedAngle(a[i].d, b[i].d,
                            this.ruleOrder[i]));
                        console.assert(a[i].c == b[i].c);
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
        var s = v1.clone().cross(v2);
        var c = v1.clone().dot(v2);
        var a = Math.atan2(s.length(), c);
        if (!s.equals(axis)) {
            a *= -1;
        }
        return a;
    }


    //https://stackoverflow.com/a/25199671
    rotateRule(rule, q) {
        var l=6;
        var newRule = Array(l);
        for (var i=0; i<l; i++) {
            var face = this.ruleOrder[i];
            var newFace = face.clone().applyQuaternion(q).round();
            var newFaceDir = rule[i].d.clone().applyQuaternion(q).round();
            var iNewFace = this.ruleOrder.findIndex(
                function(element){return newFace.equals(element)
            });
            newRule[iNewFace] = {'c': rule[i].c, 'd': newFaceDir};
        }
        return newRule;
    }
    //https://stackoverflow.com/a/25199671
    rotateRuleFromTo(rule, vFrom, vTo) {
        var quaternion = new THREE.Quaternion(); // create one and reuse it
        quaternion.setFromUnitVectors(vFrom, vTo);
        return this.rotateRule(rule, quaternion);
    }
    rotateRuleAroundAxis(rule, axis, angle) {
        var quaternion = new THREE.Quaternion(); // create one and reuse it
        quaternion.setFromAxisAngle(axis, angle);
        return this.rotateRule(rule, quaternion);
    }

    // From stackoverflow/a/12646864
    shuffleArray(a) {
        for (var i = a.length -1; i>0; i--) {
         // var j = Math.floor(Math.random() * (i + 1));
            var j = Math.floor(Math.random() * (i+1));
            var temp = a[i];
            a[i] = a[j];
            a[j] = temp;
        }
    }

    randOrdering(length) {
        var l = new Array(length);
        for (var i=0; i<length; i++) {
            l[i]=i;
        }
        this.shuffleArray(l);
        return l;
    }

    processMoves() {
        var nMoves = this.moveKeys.length;
        if (nMoves > 0) { // While we have moves to process
            // Pick a random move
            var key = this.moveKeys[Math.floor(Math.random()*nMoves)];

            // Pick a random rule order
            var ruleIdxs = this.randOrdering(this.rules.length);
            // Check if we have a rule that fits this move
            for (var r=0; r<this.rules.length; r++) {
                var rule = this.rules[ruleIdxs[r]];
                rule = this.ruleFits(this.moves[key].rule, rule);
                if(rule) {
                    for (var i=0; i<rule.length; i++) {
                        let neigb = this.moves[key].rule[i]
                        if (neigb != null) {
                            if (neigb.c == rule[i].c && neigb.d.equals(rule[i].d)) {
                                this.matches++;
                            } else {
                                this.mismatches++;
                            }
                        }
                    }
                    this.addCube(this.moves[key].pos, rule, ruleIdxs[r]);
                    if (this.cubeMap.size >= this.nMaxCubes) {
                        scene.background = new THREE.Color(0xeecccc);
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
        render();
        requestAnimationFrame(this.processMoves.bind(this));
    }

    //Need both rule and ruleIdx to determine color as the rule might be rotated
    addCube(position, rule, ruleIdx) {
        // Go through all non-zero parts of the rule and add potential moves
        var potentialMoves = [];
        for (var i=0; i<rule.length; i++) {
            if (rule[i].c == 0) {
                continue;
            }
            var direction = this.ruleOrder[i].clone().negate();
            var movePos = position.clone().add(this.ruleOrder[i])
            if (Math.abs(movePos.x)>this.maxCoord ||
               Math.abs(movePos.y)>this.maxCoord ||
               Math.abs(movePos.z)>this.maxCoord)
            {
                // Neigbour outside of bounding box, stopping here
                continue;
            }
            var key = vecToStr(movePos);
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
            var r = position.clone().sub(movePos);
            var dirIdx = this.ruleOrder.findIndex(
                function(element){return r.equals(element)}
            );

            //Make sure we haven't written anything here before:
            if (this.moves[key].rule[dirIdx]) {
                return;
            }


            potentialMoves.push({
                'key': key,
                'dirIdx': dirIdx,
                'val': rule[i].c*-1,
                'd': rule[i].d
            });
        }
        potentialMoves.forEach(i => {
            this.moves[i.key].rule[i.dirIdx] = {'c': i.val, 'd': i.d};
        });

        this.drawCube(position, rule, ruleIdx);

        this.centerOfMass.multiplyScalar(this.cubeMap.size);
        this.centerOfMass.add(position);
        this.cubeMap.set(vecToStr(position), true);
        this.centerOfMass.divideScalar(this.cubeMap.size);

        camera.lookAt(this.centerOfMass);

        render();
    }

    drawCube(position, rule, ruleIdx) {
        var cube = new THREE.Group();
        var centerCube = new THREE.Mesh(
            this.centerCubeGeo, this.cubeMaterials[ruleIdx]);
        cube.add(centerCube);
        for (var j=0; j<rule.length; j++) {
            if (rule[j].c != 0) {
                var material = this.colorMaterials[Math.abs(rule[j].c) - 1].clone();
                if (rule[j].c < 0) {
                    material.color.addScalar(-0.2);
                }
                var connectorCube = new THREE.Mesh(
                    this.connectorCubeGeo, material
                );
                connectorCube.position.add(
                    this.ruleOrder[j].clone().multiplyScalar(0.3)
                );
                var connectorPointer = new THREE.Mesh(
                    this.connectorPointerGeo, material
                );
                connectorPointer.position.copy(connectorCube.position);
                connectorPointer.position.add(rule[j].d.clone().multiplyScalar(0.2));
                cube.add(connectorCube);
                cube.add(connectorPointer);
            }
        }
        cube.position.copy(position);
        cube.name = "Cube";
        scene.add(cube);
        objects.push(cube);
    }

}
