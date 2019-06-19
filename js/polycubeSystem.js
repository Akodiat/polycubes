class PolycubeSystem {

    constructor(rules, ruleOrder, nMaxCubes=100, maxCoord=50) {
        this.moves = {};
        this.moveKeys = [];
        this.cubeMap = new Map();
        this.nMaxCubes = nMaxCubes;
        this.maxCoord = maxCoord;

        this.colorMaterials = [];

        this.ruleOrder = ruleOrder;
        this.rules = rules;
        var nColors = Math.max.apply(Math, rules.map(x => Math.max.apply(
            Math, x.map(r => r.c)))
        );
        var colors = randomColor({
            luminosity: 'light',
            count: nColors
        });
        for (var i=0; i<colors.length; i++) {
            var colorMaterial = new THREE.MeshLambertMaterial({
                color: colors[i]
            });
            this.colorMaterials.push(colorMaterial);
        }
        this.cubeMaterial = new THREE.MeshLambertMaterial({
                color: "White",
        });

        this.ruleCubes = [];

        var centerCubeSize = 0.7;
        var connectorCubeSize = (1-centerCubeSize);
        this.connectorCubeGeo = new THREE.BoxBufferGeometry(
            connectorCubeSize, connectorCubeSize, connectorCubeSize
        );
        this.centerCubeGeo = new THREE.BoxBufferGeometry(
            centerCubeSize, centerCubeSize, centerCubeSize
        );
    }

    ruleFits(a,b) {
        var l = a.length;
        var ra = this.randOrdering(l);
        var rb = this.randOrdering(l);
        for (var ria=0; ria<l; ria++) {
            var i = ra[ria];
            if (a[i] && a[i].c != 0) {
                for (var rib=0; rib<l; rib++) {
                    var j = rb[rib];
                    if (a[i].c == b[j].c) {
                        b = this.rotateRuleFromTo(b, 
                            this.ruleOrder[j],
                            this.ruleOrder[i]);
                        console.assert(a[i].c == b[i].c);
                        b = this.rotateRuleAroundAxis(b, 
                            this.ruleOrder[i],
                           -this.getSignedAngle(a[i].d, b[i].d,
                            this.ruleOrder[i]));
                        console.assert(a[i].c == b[i].c);
                        return b;
                    }
                }
            }
        }
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
                    this.addCube(this.moves[key].pos, rule, ruleIdxs[r]);
                    // Remove processed move
                    delete this.moves[key];
                    this.moveKeys.splice(this.moveKeys.indexOf(key), 1);
                    if (this.cubeMap.size >= this.nMaxCubes) {
                        alert("Polycube is larger than a "+this.nMaxCubes+"-mer, aborting");
                        return;
                    }
                    break;
                }
            }
        } else {
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

        this.drawCube(position, rule);
        this.cubeMap.set(vecToStr(position), true);
        render();
    }

    drawCube(position, rule) {
        var cube = new THREE.Group();
        var centerCube = new THREE.Mesh(this.centerCubeGeo, this.cubeMaterial);
        cube.add(centerCube);
        for (var j=0; j<rule.length; j++) {
            if (rule[j].c != 0) {
                console.log(Math.abs(rule[j].c));
                var connectorCube = new THREE.Mesh(
                    this.connectorCubeGeo,
                    this.colorMaterials[Math.abs(rule[j].c) - 1]
                );
                connectorCube.position.add(
                    this.ruleOrder[j].clone().multiplyScalar(0.4)
                );
                cube.add(connectorCube);
            }
        }
        cube.position.copy(position);
        scene.add(cube);
        objects.push(cube);
    }

}
