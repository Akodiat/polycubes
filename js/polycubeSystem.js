class PolycubeSystem {

    constructor(rules, ruleOrder, scene, nMaxCubes=1000, maxCoord=100, assemblyMode='seeded') {
        this.moves = {};
        this.moveKeys = [];
        this.cubeMap = new Map();
        this.centerOfMass = new THREE.Vector3();
        this.nMaxCubes = nMaxCubes;
        this.maxCoord = maxCoord;

        this.assemblyMode = assemblyMode;
        this.orderIndex = 0;

        this.colorMaterials = [];
        this.particleMaterials = [];
        this.matches = 0;
        this.mismatches = 0;
        this.connections = [];
        this.lineViewFactor = 2;

        this.objGroup = new THREE.Group();
        this.lineGroup = new THREE.Group();
        if (scene) {
            scene.add(this.objGroup);
            scene.add(this.lineGroup);
        }
        this.lineGroup.visible = false;

        this.ruleOrder = ruleOrder;
        this.rule = rules;
        let nColors = Math.max.apply(Math, rules.map(x => Math.max.apply(
            Math, x.map(r => Math.abs(r.color))))
        );
        nColors = Math.max(nColors, 2) //Avoid getting only red colors

        // connectionColors = randomColor({luminosity: 'light', count: nColors, seed: 1337});
        for (let i=0; i<nColors; i++) {
            let colorMaterial = new THREE.MeshLambertMaterial({
                color: selectColor(i)
            });
            this.colorMaterials.push(colorMaterial);
        }

        //let particleColors = randomColor({luminosity: 'light', count: rules.length, seed: 19});
        for (let i=0; i<rules.length; i++) {
            let cubeMaterial = new THREE.MeshLambertMaterial({color: selectColor(i)});
            this.particleMaterials.push(cubeMaterial);
        }

        this.cubeSize = 0.7;
        let connectorCubeSize = (1-this.cubeSize);
        this.connectorCubeGeo = new THREE.BoxBufferGeometry(
            connectorCubeSize, connectorCubeSize, connectorCubeSize
        );
        this.connectorPointerGeo = new THREE.BoxBufferGeometry(
            connectorCubeSize/2, connectorCubeSize/2, connectorCubeSize/2
        );
        this.centerCubeGeo = new THREE.BoxBufferGeometry(
            this.cubeSize, this.cubeSize, this.cubeSize
        );

        this.connectorLineMaterial = new THREE.LineBasicMaterial({color: 0x555555, linewidth: 20});
    }

    isPolycubeSystem() {
        return true;
    }

    seed() {
        let i = 0;
        if(this.assemblyMode == 'stochastic') {
            i = Math.floor(Math.random() * this.rule.length);
        }
        this.addParticle(new THREE.Vector3(), system.rule[i], i);
    }

    reset() {
        this.objGroup.children = [];
        this.moves = {};
        this.moveKeys = [];
        this.cubeMap = new Map();
        this.matches = 0;
        this.mismatches = 0;
        this.connections = [];
        this.lineGroup.visible = false;
        while(this.lineGroup.children.length > 0) {
            this.lineGroup.children.pop();
        }
        this.particleMaterials.forEach(m=>{
            m.transparent = false;
            m.opacity = 1;
        });
        this.orderIndex = 0;
        render();
    }

    regenerate() {
        this.reset();
        this.seed();
        this.processMoves();
        render();
        if (typeof window !== 'undefined') {
            let argstr = "?assemblyMode="+this.assemblyMode + (this.rule.length > 0 ? "&rule="+this.getRuleStr() : "");
            window.history.pushState(null, null, argstr);
        }
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

    resetAssemblyMode(assemblyMode) {
        this.assemblyMode = assemblyMode;
        this.regenerate();
    }

    resetRule(rule) {
        this.reset();
        this.rule = rule;

        let nColors = Math.max.apply(Math, rule.map(x => Math.max.apply(
            Math, x.map(r => Math.abs(r.color))))
        );
        nColors = Math.max(nColors, 2) //Avoid getting only red colors

        for (let i=0; i<nColors; i++) {
            let colorMaterial = new THREE.MeshLambertMaterial({
                color: selectColor(i)
            });
            this.colorMaterials.push(colorMaterial);
        }

        for (let i=0; i<rule.length; i++) {
            let cubeMaterial = new THREE.MeshLambertMaterial({
                color: selectColor(i),
            });
            this.particleMaterials.push(cubeMaterial);
        }

        this.seed();
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

    tryProcessMove(movekey, ruleIdx) {
        let rule = this.rule[ruleIdx];
        rule = this.ruleFits(this.moves[movekey].rule, rule);
        if(rule) {
            for (let i=0; i<rule.length; i++) {
                let neigb = this.moves[movekey].rule[i]
                if (neigb != null) {
                    if (neigb.color == rule[i].color && neigb.alignDir.equals(rule[i].alignDir)) {
                        this.matches++;
                        this.connections.push([
                            this.moves[movekey].pos.clone(),
                            this.moves[movekey].pos.clone().add(ruleOrder[i]),
                            Math.abs(neigb.color)
                        ])
                    } else {
                        this.mismatches++;
                    }
                }
            }
            this.addParticle(this.moves[movekey].pos, rule, ruleIdx);
            return true;
        }
        return false;
    }

    processMoves(background = false) {
        let nMoves = this.moveKeys.length;
        if (nMoves > 0) { // While we have moves to process
            // If we should assemble everything in order
            if (this.assemblyMode == 'ordered') {
                // Go through moves in random order
                let tried = new Set();
                let untried = this.moveKeys.slice(); //Make shallow copy
                while(untried.length > 0){
                    // Get a random untried move key
                    let i = Math.floor(untried.length * Math.random());
                    let key = untried[i];
                    // Try to add the current cube type
                    let result = this.tryProcessMove(key, this.orderIndex);
                    if (result) {
                        // Remove processed move
                        delete this.moves[key];
                        this.moveKeys.splice(this.moveKeys.indexOf(key), 1);
                    }
                    tried.add(key);
                    // Movekeys might have updated, if we added cubes
                    untried = this.moveKeys.filter(i=>!tried.has(i));

                    // Check if polycube is getting too large
                    if (this.cubeMap.size >= this.nMaxCubes) {
                        render();
                        if (!background) {
                            window.dispatchEvent(new Event('oub'));
                        }
                        console.log("Unbounded");
                        return 'oub';
                    }
                }
                // When we have tried the current cube type for all moves
                // in queue, increase index to try the next one next time
                this.orderIndex++;
                if (this.orderIndex >= this.rule.length) {
                    if (!background) {
                        window.dispatchEvent(new Event('movesProcessed'));
                    }
                    console.log("Moves processed");
                    return true;
                }
            } else {
                // Pick a random move
                let key = this.moveKeys[Math.floor(Math.random()*nMoves)];
                // Pick a random rule order
                let ruleIdxs = this.randOrdering(this.rule.length);
                // Check if we have a rule that fits this move
                for (let r=0; r<this.rule.length; r++) {
                    let result = this.tryProcessMove(key, ruleIdxs[r]);
                    if (result) {
                        break;
                    }
                }
                // Remove processed move
                delete this.moves[key];
                this.moveKeys.splice(this.moveKeys.indexOf(key), 1);
            }

            // Check if polycube is getting too large
            if (this.cubeMap.size >= this.nMaxCubes) {
                render();
                if (!background) {
                    window.dispatchEvent(new Event('oub'));
                }
                console.log("Unbounded");
                return 'oub';
            }
        } else {
            if (!background) {
                window.dispatchEvent(new Event('movesProcessed'));
            }
            console.log("Moves processed");
            return true;
        }
        //render();
        if (!background) {
            requestAnimationFrame(this.processMoves.bind(this, false));
        }
        return false;
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

    makeLine(a, b, color) {
        a.sub(a.clone().sub(b).setLength(this.cubeSize/3));
        b.sub(b.clone().sub(a).setLength(this.cubeSize/3));
        const points = [];
        points.push(a);
        points.push(b);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = this.connectorLineMaterial.clone();
        material.color.set(selectColor(color-1));
        return new THREE.Line(geometry, material);
    }

    toggleLineView() {
        if (!this.lineGroup.visible) {
            //this.objGroup.visible = false;
            this.lineGroup.visible = true;
            if (this.lineGroup.children.length == 0) {
                this.connections.forEach(c=>{
                    const [cA, cB, color] = c;
                    this.lineGroup.add(this.makeLine(cA,cB, color));
                });
            }
            this.objGroup.children.forEach(cube=>{
                cube.scale.multiplyScalar(1/this.lineViewFactor);
            });
            this.particleMaterials.forEach(m=>{
                m.transparent = true;
                m.opacity = 0.5;
            });
        } else {
            this.objGroup.visible = true;
            this.lineGroup.visible = false;
            this.objGroup.children.forEach(cube=>{
                cube.scale.multiplyScalar(this.lineViewFactor);
            });
            this.particleMaterials.forEach(m=>{
                m.transparent = false;
                m.opacity = 1;
            });
        }
        //render();
        fitCamera();
    }

    toggleFog(density=0.08) {
        if (!scene.fog || scene.fog.density != density) {
            scene.fog = new THREE.FogExp2(0xffffff, density);
        } else {
            scene.fog = undefined;
        }
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
                } else {
                    material.color.addScalar(-0.1);
                }
                let connectorCube = new THREE.Mesh(
                    this.connectorCubeGeo, material
                );
                connectorCube.position.add(
                    this.ruleOrder[j].clone().multiplyScalar(0.4)
                );
                let dim = this.ruleOrder[j].clone();
                dim.setX(Math.abs(dim.x)).setY(Math.abs(dim.y)).setZ(Math.abs(dim.z));
                connectorCube.scale.copy(
                    new THREE.Vector3(1,1,1).sub(dim.multiplyScalar(0.65))
                );
                let connectorPointer = new THREE.Mesh(
                    this.connectorPointerGeo, material
                );
                connectorPointer.scale.copy(connectorCube.scale);
                connectorPointer.position.copy(connectorCube.position);
                connectorPointer.position.add(rule[j].alignDir.clone().multiplyScalar(0.2));
                cube.add(connectorCube);
                cube.add(connectorPointer);
            }
        }
        cube.position.copy(position);
        cube.name = "Cube";
        this.objGroup.add(cube);
    }

}
