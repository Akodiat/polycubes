function vecToStr(v) {
    return `(${v.x},${v.y},${v.z})`;
}

function mod(n, m) {
    return ((n % m) + m) % m;
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

function getPosAngle(v1, v2, axis) {
    return mod(getSignedAngle(v1, v2, axis), 2*Math.PI)
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

class Patch {
    constructor(color, phi, theta, rotation) {
        this.color = color;
        this.phi = phi;
        this.theta = theta;
        this.rotation = rotation;
    }

    static getDefaultAlignDir(pos) {
        // Hairy ball theorem creates trouble...
        //let north = new THREE.Vector3(0,1,0);
        let north = new THREE.Vector3(3,5,7).normalize();
        
        console.log(pos.distanceTo(north) < 1E-3);
        if(pos.equals(north)) {
            console.warn("Position is North")
            //return new THREE.Vector3(1,0,0);
        } else if (pos.equals(north.clone().negate())) {
            console.warn("Position is South")
            //return new THREE.Vector3(-1,0,0);
        }
        
        return north.projectOnPlane(pos).normalize();
    }

    getAlignDir() {
        let pos = this.getLocalPos();
        let defaultDir = Patch.getDefaultAlignDir(pos);
        let a = defaultDir.applyAxisAngle(pos, this.rotation).normalize();
        console.assert(Math.abs(a.angleTo(pos) - Math.PI/2) < 1e-3, `Incorrect align dir: ${a.angleTo(pos)}`);
        return a;
    }

    getLocalPos() {
        return new THREE.Vector3().setFromSphericalCoords(1, this.phi, this.theta);
    }

    static fromVectors(localPos, alignDir, color) {
        let defAlignDir = Patch.getDefaultAlignDir(localPos);
        let rotation = getSignedAngle(defAlignDir, alignDir, localPos);

        let tmp = defAlignDir.clone().applyAxisAngle(localPos, rotation);
        console.assert(
            alignDir.distanceTo(tmp) < 1e-3, 
            `Incorrect patch rotation ${vecToStr(alignDir)} != ${vecToStr(tmp)}`
        );
        
        let s = new THREE.Spherical().setFromVector3(localPos);
        return new Patch(color, s.phi, s.theta, rotation);
    }

    rotated(q) {
        let newPos = this.getLocalPos().applyQuaternion(q).normalize();
        let newAlignDir = this.getAlignDir().applyQuaternion(q).normalize();
        return Patch.fromVectors(newPos, newAlignDir, this.color);
    }

    inverted() {
        let newPos = this.getLocalPos().negate().normalize();
        let newAlignDir = this.getAlignDir().normalize();
        return Patch.fromVectors(newPos, newAlignDir, -this.color);
    }
}

class Move {
    constructor(patches, pos) {
        this.patches = patches;
        this.pos = pos;
    }
}

class PolysphereSystem {

    constructor(rule, nMaxCubes=1000, maxCoord=100) {
        this.moves = [];
        this.particles = [];
        this.centerOfMass = new THREE.Vector3();
        this.nMaxCubes = nMaxCubes;
        this.maxCoord = maxCoord;

        this.interfaceMaterials = [];
        this.particleMaterials = [];
        this.matches = 0;
        this.mismatches = 0;

        this.objGroup = new THREE.Group();
        scene.add(this.objGroup);

        this.rule = rule;
        let nColors = Math.max.apply(Math, rule.map(x => Math.max.apply(
            Math, x.map(r => Math.abs(r.color))))
        );
        nColors = Math.max(nColors, 2) //Avoid getting only red colors

        let connectionColors = randomColor({luminosity: 'light', count: nColors, seed: 1});
            for (let i=0; i<nColors; i++) {
            let colorMaterial = new THREE.MeshLambertMaterial({color: connectionColors[i]});
                this.interfaceMaterials.push(colorMaterial);
            }

        let cubeColors = randomColor({luminosity: 'light',  hue: 'monochrome', count: rule.length, seed: 1});
            for (let i=0; i<rule.length; i++) {
            let cubeMaterial = new THREE.MeshStandardMaterial({color: cubeColors[i], roughness:0.8, metallness:0.8});
                this.particleMaterials.push(cubeMaterial);
            }

        let sphereSize = 0.4;
        let connectorSize = 0.1;
        this.connectorGeo = new THREE.CylinderBufferGeometry(
            connectorSize, .5*connectorSize, 0.2, 16
        );
        this.connectorPointerGeo = new THREE.CylinderBufferGeometry(
            connectorSize/2, connectorSize/2, connectorSize, 16
        );
        this.sphereGeo = new THREE.SphereBufferGeometry(
            sphereSize, 16, 16
        );

        document.addEventListener("keydown", event => {
            if (event.key == 's' && event.ctrlKey) {
                event.preventDefault();
                this.getCoordinateFile();
            }
        });
    }

    reset() {
        objects = objects.filter(function(e) { return e.name !== "Cube" })
        this.objGroup.children = [];
        this.moves = [];
        this.particles = [];
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

    resetRule(rule) {
        this.reset();
        this.rule = rule;

        let nColors = Math.max.apply(Math, rule.map(x => Math.max.apply(
            Math, x.map(r => Math.abs(r.color))))
        );
        nColors = Math.max(nColors, 2) //Avoid getting only red colors

        for (let i=0; i<nColors; i++) {
            let colorMaterial = new THREE.MeshLambertMaterial({
                color: randomColor({luminosity: 'light'})
            });
            this.interfaceMaterials.push(colorMaterial);
        }

        for (let i=0; i<rule.length; i++) {
            let cubeMaterial = new THREE.MeshLambertMaterial({
                color: randomColor({luminosity: 'light',  hue: 'monochrome'})
            });
            this.particleMaterials.push(cubeMaterial);
        }

        this.addParticle(new THREE.Vector3(), rule[0], 0);

        this.processMoves();
        render();
    }

    getMismatchRatio() {
        return this.mismatches / (this.matches + this.mismatches)
    }

    getCoordinateFile() {
        let filename = `${this.getHexRule()}.${this.particles.length}-mer`;
        let text = ""
        this.particles.forEach(p=>{text += vecToStr(p.pos) + '\n'});
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
        let la = a.length;
        let lb = b.length;
        // Traverse rule patches in random order
        let ra = this.randOrdering(la);
        let rb = this.randOrdering(lb);
        // For each patch in rule a...
        for (let ria=0; ria<la; ria++) {
            let i = ra[ria];
            // ...that is non-zero
            if (a[i] && a[i].color != 0) {
                // Check each patch in rule b
                for (let rib=0; rib<lb; rib++) {
                    let j = rb[rib];
                    // If we find an equal color
                    if (a[i].color == b[j].color) {
                        // Rotate rule b so that the matching face has
                        // the same direction:
                        b = this.rotateRuleFromTo(b,
                            b[j].getLocalPos(),
                            a[i].getLocalPos());
                        console.assert(a[i].getLocalPos().distanceTo(b[j].getLocalPos()) < 1e-4);
                        // ...and the same rotation:
                        b = this.rotateRuleFromTo(b,
                            b[j].getAlignDir(),
                            a[i].getAlignDir()
                        );
                        console.assert(a[i].getAlignDir().distanceTo(b[j].getAlignDir()) < 1e-4);
                        // Return the rotated rule b
                        return b;
                    }
                }
            }
        }
        // Return false if we didn't find any matching faces
        return false;
    }

    //https://stackoverflow.com/a/25199671
    rotatePatches(patches, q) {
        return patches.map(patch=>patch.rotated(q));
    }
    //https://stackoverflow.com/a/25199671
    rotateRuleFromTo(rule, vFrom, vTo) {
        let quaternion = new THREE.Quaternion(); // create one and reuse it
        quaternion.setFromUnitVectors(vFrom, vTo);
        return this.rotatePatches(rule, quaternion);
    }
    rotateRuleAroundAxis(rule, axis, angle) {
        let quaternion = new THREE.Quaternion(); // create one and reuse it
        quaternion.setFromAxisAngle(axis, angle);
        return this.rotatePatches(rule, quaternion);
    }

    // From stackoverflow/a/12646864
    shuffleArray(a) {
        for (let i = a.length -1; i>0; i--) {
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
        let nMoves = this.moves.length;
        if (nMoves > 0) { // While we have moves to process
            // Pick a random move
            let move = this.moves[Math.floor(Math.random()*nMoves)];

            // Pick a random rule order
            let ruleIdxs = this.randOrdering(this.rule.length);
            // Check if we have a rule that fits this move
            for (let r=0; r<this.rule.length; r++) {
                let patches = this.rule[ruleIdxs[r]];
                patches = this.ruleFits(move.patches, patches);
                if(patches) {
                    /*
                    for (let i=0; i<patches.length; i++) {
                        let neigb = move.patches[i]
                        if (neigb != null) {
                            if (neigb.color == patches[i].color && neigb.getAlignDir().equals(patches[i].getAlignDir())) {
                                this.matches++;
                            } else {
                                this.mismatches++;
                            }
                        }
                    }
                    */
                    this.addParticle(move.pos, patches, ruleIdxs[r]);
                    if (this.particles.length >= this.nMaxCubes) {
                        render();
                        window.dispatchEvent(new Event('oub'));
                        console.log("Unbounded");
                        return;
                    }
                    break;
                }
            }
            // Remove processed move
            this.moves.splice(this.moves.indexOf(move), 1);
        } else {
            window.dispatchEvent(new Event('movesProcessed'));
            console.log("Moves processed");
            return;
        }
        //render();
        requestAnimationFrame(this.processMoves.bind(this));
    }

    //Need both rule and ruleIdx to determine color as the rule might be rotated
    addParticle(position, patches, ruleIdx) {
        // Go through all non-zero parts of the rule and add potential moves
        let potentialMoves = [];
        for (let i=0; i<patches.length; i++) {
            let patch = patches[i];
            if (patch.color == 0) {
                continue;
            }
            let movePos = position.clone().add(patch.getLocalPos());
            if (Math.abs(movePos.x)>this.maxCoord ||
               Math.abs(movePos.y)>this.maxCoord ||
               Math.abs(movePos.z)>this.maxCoord)
            {
                // Neigbour outside of bounding box, stopping here
                continue;
            }
            let blocking = this.particles.find(p=>{return p.pos.distanceTo(movePos) <= 1});
            if (blocking) {
                // There is already a cube at pos,
                // no need to add this neigbour to moves
                continue
            }

            let move = this.moves.find(move=>{move.pos.equals(movePos)});

            if (!move) {
                move = new Move([], movePos);
            }
            move.patches.push(patch.inverted());
                
            potentialMoves.push(move);
        }
        potentialMoves.forEach(move => {
            this.moves.push(move);
        });

        this.drawParticle(position, patches, ruleIdx);

        this.centerOfMass.multiplyScalar(this.particles.length);
        this.centerOfMass.add(position);
        this.particles.push({pos: position, rule: patches});
        this.centerOfMass.divideScalar(this.particles.length);

        render();
    }

    drawParticle(position, patches, ruleIdx) {
        let particle = new THREE.Group();
        let centerCube = new THREE.Mesh(
            this.sphereGeo, this.particleMaterials[ruleIdx]);
        particle.add(centerCube);
        patches.forEach(patch=>{
            if (patch.color != 0) {
                let material = this.interfaceMaterials[Math.abs(patch.color) - 1].clone();
                if (patch.color >= 0) {
                    material.emissive = material.color.clone().addScalar(-0.5);
                }
                let connector = new THREE.Mesh(
                    this.connectorGeo, material
                );
                connector.position.copy(patch.getLocalPos().multiplyScalar(.4));
                //connector.lookAt(patch.getLocalPos());
                //connector.rotateOnWorldAxis(patch.getLocalPos(), patch.rotation)
                //connector.setRotationFromAxisAngle(patch.getLocalPos(), patch.rotation);
                connector.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), patch.getLocalPos());
                //connector.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), patch.getAlignDir());
                let connectorPointer = new THREE.Mesh(
                    this.connectorPointerGeo, material
                );
                connectorPointer.position.copy(connector.position);
                connectorPointer.position.add(patch.getAlignDir().multiplyScalar(0.1));
                connectorPointer.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), patch.getAlignDir());

                //connectorPointer.quaternion.setFromUnitVectors(patch.getLocalPos(), patch.getAlignDir());
                //connector.quaternion.setFromUnitVectors(patch.getAlignDir(), patch.getLocalPos());
                //connectorPointer.lookAt(connector.position);
                //connectorPointer.lookAt(new THREE.Vector3());
                //connector.lookAt(new THREE.Vector3());
                //connector.rotateOnAxis(patch.getLocalPos(), patch.rotation);
                //connector.lookAt(patch.getAlignDir());
                particle.add(connectorPointer);
                particle.add(connector);
            }
        });
        particle.position.copy(position);
        particle.name = "Particle";
        this.objGroup.add(particle);
        objects.push(particle);
    }

}
