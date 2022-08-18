function vecToStr(v) {
    return `(${v.x},${v.y},${v.z})`;
}

function mod(n, m) {
    return ((n % m) + m) % m;
}

function round(val, nDecimals) {
    let factor = Math.pow(10, nDecimals);
    return Math.round((val + Number.EPSILON) * factor) / factor;
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
    constructor(color, pos, q) {
        this.pos = pos;
        this.q = q.normalize();
        this.color = parseInt(color);
    }

    update(color, pos, q) {
        if (color !== undefined) this.color = color;
        if (pos !== undefined) this.pos = pos;
        if (q !== undefined) this.q = q.normalize();
    }

    get alignBase() {
        return new THREE.Vector3(1,0,0);
    }

    get dirBase() {
        return new THREE.Vector3(0,1,0);
    }

    get alignDir() {
        return this.alignBase.applyQuaternion(this.q);
    }

    get dir() {
        return this.dirBase.applyQuaternion(this.q);
    }

    toJSON() {
        return [
            this.color,
            this.pos.toArray(),
            this.q.toArray()
        ].flat();
    }

    rotated(q) {
        let newPos = this.pos.clone().applyQuaternion(q);
        let newQ = this.q.clone().premultiply(q).normalize();
        //let newQ = q.clone().premultiply(this.q);
        return new Patch(this.color, newPos, newQ);
    }
}

class Move {
    constructor(patch, pos) {
        this.patch = patch;
        this.pos = pos;
    }
}

class KlossSystem {

    constructor(rule, scene, maxParticles=1000, maxCoord=100) {
        this.moves = [];
        this.particles = [];
        this.centerOfMass = new THREE.Vector3();
        this.maxParticles = maxParticles;
        this.maxCoord = maxCoord;

        this.particleMaterials = [];
        this.matches = 0;
        this.mismatches = 0;

        this.objGroup = new THREE.Group();
        scene.add(this.objGroup);

        this.patchObjects = [];

        this.rule = rule;

        for (let i=0; i<rule.length; i++) {
            let particleMaterial = new THREE.MeshLambertMaterial({
                transparent: true,
                opacity: 0.5,
                //side: THREE.DoubleSide,
                color: selectColor(i)
            });
            this.particleMaterials.push(particleMaterial);
        }

        let connectorSize = 0.1;
        this.connectorGeo = new THREE.CylinderBufferGeometry(
            connectorSize, .5*connectorSize, 0.2, 4
        );
        this.connectorGeo.rotateX(Math.PI/2); // Make cylinder axis face forward
        this.connectorPointerGeo = new THREE.CylinderBufferGeometry(
            connectorSize/2, connectorSize/2, connectorSize, 4
        );
        this.connectorPointerGeo.rotateX(Math.PI/2); // Make cylinder axis face forward
        this.sphereGeo = new THREE.SphereBufferGeometry(
            .1, 16, 16
        );

        console.log(this.getRuleStr());
    }

    isPolycubeSystem() {
        return false;
    }

    reset() {
        this.objGroup.children = [];
        this.patchObjects = [];
        this.moves = [];
        this.particles = [];
        this.matches = 0;
        this.mismatches = 0;
        render();
    }

    resetRandom(maxS=4, maxP=4, maxC=4) {
        let fr = (max, min=0) => Math.random()*(max-min)+min;
        let r = (max, min=0) => Math.round(fr(max,min));
        let nSpecies = r(maxS, 1);
        let rule = []
        while (nSpecies--) {
            let s = []
            let nPatches = r(maxP);
            while (nPatches--) {
                s.push(new Patch(
                    r(maxC) * r(1) ? -1:1,
                    new THREE.Vector3(fr(1,-1),fr(1,-1),fr(1,-1)),
                    new THREE.Quaternion(fr(1,-1),fr(1,-1),fr(1,-1),fr(1,-1))
                ))
            }
            rule.push(s);
        }
        this.resetRule(rule);
    }

    resetRule(rule) {
        this.reset();
        this.rule = rule;

        let nColors = Math.max.apply(Math, rule.map(x => Math.max.apply(
            Math, x.map(r => Math.abs(r.color))))
        );
        nColors = Math.max(nColors, 2) //Avoid getting only red colors

        /*
        for (let i=0; i<nColors; i++) {
            let colorMaterial = new THREE.MeshLambertMaterial({
                color: selectColor(i)
            });
            this.colorMaterials.push(colorMaterial);
        }
        */

        for (let i=0; i<rule.length; i++) {
            let particleMaterial = new THREE.MeshLambertMaterial({color: selectColor(i)});
            this.particleMaterials.push(particleMaterial);
        }

        this.addParticle(new THREE.Vector3(), new THREE.Quaternion(), rule[0], 0);

        this.processMoves();
        render();
    }

    seed() {
        let i = 0;
        if(this.assemblyMode == 'stochastic') {
            i = Math.floor(Math.random() * this.rule.length);
        }
        this.addParticle(new THREE.Vector3(), new THREE.Quaternion(), this.rule[i], i);
    }

    regenerate() {
        this.reset();
        this.seed();
        this.processMoves();
    }

    getMismatchRatio() {
        return this.mismatches / (this.matches + this.mismatches)
    }

    getRuleStr() {
        return JSON.stringify(this.rule)
    }

    getCoordinateFile() {
        let filename = `${this.getRuleStr()}.${this.particles.length}-mer`;
        let text = ""
        this.particles.forEach(p=>{text += vecToStr(p.pos) + '\n'});
        saveString(text, filename);
    }

    exportGLTF() {
        // Instantiate an exporter
        let exporter = new THREE.GLTFExporter();
        let options = {'forceIndices': true};

        // Parse the input and generate the glTF output
        exporter.parse(this.objGroup, function (result) {
            if (result instanceof ArrayBuffer) {
                saveArrayBuffer(result, 'scene.glb');
            } else {
                let output = JSON.stringify(result, null, 2);
                console.log(output);
                saveString(output, 'scene.gltf');
            }
        }, options);
    }

    compatibleColors(c1, c2) {
        return c1 == -c2;
    }

    ruleFits(patch, species) {
        let length = species.length;
        // Traverse rule patches in random order
        let r = this.randOrdering(length);
        // Make sure patch is not empty
        //if (patch.color != 0) {
            let facingDir = patch.dir.clone().negate();
            // Check each patch in species
            for (let rib=0; rib<length; rib++) {
                let i = r[rib];
                // If we find an equal color
                if (this.compatibleColors(patch.color, species[i].color)) {
                    // Set the same orientation
                    let q = patch.q.clone().multiply(species[i].q.clone().invert());
                    //let q = species[i].q.clone().multiply(patch.q.clone().invert());

                    q.premultiply(new THREE.Quaternion().setFromAxisAngle(
                        patch.alignDir, Math.PI)
                    );

                    species = this.rotatePatches(species, q);
                    console.assert(
                        facingDir.distanceTo(species[i].dir) < 1e-4,
                        'Still facing wrong direction'
                    );
                    console.assert(
                        patch.alignDir.distanceTo(species[i].alignDir) < 1e-4,
                        'Still having incorrect alignment'
                    );

                    return {
                        'i': i,
                        'q': q//q1.multiply(q2)
                    };
                }
            }
        //}
        // Return false if we didn't find any matching faces
        return false;
    }

    rotatePatches(patches, q) {
        return patches.map(patch=>patch.rotated(q.normalize()));
    }

    rotationFromTo(vFrom, vTo) {
        return new THREE.Quaternion().setFromUnitVectors(vFrom, vTo);
    }

    rotateRuleFromTo(rule, vFrom, vTo) {
        return this.rotatePatches(rule, new THREE.Quaternion().setFromUnitVectors(vFrom, vTo));
    }
    rotateRuleAroundAxis(rule, axis, angle) {
        return this.rotatePatches(rule, new THREE.Quaternion().setFromAxisAngle(axis, angle));
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
                let species = this.rule[ruleIdxs[r]];
                let fit = this.ruleFits(move.patch, species);
                if(fit) {
                    let rotatedSpecies = this.rotatePatches(species, fit.q);
                    let newPos = move.pos.clone().add(move.patch.pos).sub(rotatedSpecies[fit.i].pos);

                    // Avoid collision
                    if(!this.particles.find(p=>{return p.pos.distanceTo(newPos) < 0.9})){
                        this.addParticle(newPos, fit.q, species, ruleIdxs[r], fit.i);
                    }

                    if (this.particles.length >= this.maxParticles) {
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
    addParticle(position, q, species, ruleIdx, boundAtIdx=undefined) {
        // Go through all non-zero parts of the rule and add potential moves
        let rotatedSpecies = this.rotatePatches(species, q);
        for (let i=0; i<rotatedSpecies.length; i++) {
            if (boundAtIdx !== undefined && i == boundAtIdx) {
                // This patch is already bound
                continue;
            }
            let patch = rotatedSpecies[i];
            /*
            if (patch.color == 0) {
                // Zero patches doesn't bind
                continue;
            }
            */
            let patchPos = position.clone().add(patch.pos);

            if (Math.abs(patchPos.x)>this.maxCoord ||
               Math.abs(patchPos.y)>this.maxCoord ||
               Math.abs(patchPos.z)>this.maxCoord)
            {
                // Patch outside of bounding box, stopping here
                continue;
            }

            let blocking = this.particles.find(p=>{return p.pos.distanceTo(patchPos) <= 1});
            if (blocking) {
                // There is already something at pos,
                // no need to add this neigbour to moves
                continue
            }

            let move = new Move(patch, position);
            this.moves.push(move);
        }

        this.drawParticle(position, q, species, ruleIdx);

        this.centerOfMass.multiplyScalar(this.particles.length);
        this.centerOfMass.add(position);
        this.particles.push({pos: position, rule: species});
        this.centerOfMass.divideScalar(this.particles.length);

        render();
    }

    drawParticle(position, q, species, ruleIdx) {
        let particle = new THREE.Group();
        const linePoints = [new THREE.Vector3];

        species.forEach((patch,i)=>{
            let patchGroup = new THREE.Group();

            let material = new THREE.MeshLambertMaterial({
                color: selectColor(Math.abs(patch.color) - 1)
            });
            if (patch.color >= 0) {
                material.emissive = material.color.clone().addScalar(-0.5);
            }

            let connector = new THREE.Mesh(
                this.connectorGeo, material
            );
            connector.lookAt(patch.dirBase);

            patchGroup.add(connector);

            let connectorPointer = new THREE.Mesh(
                this.connectorPointerGeo, material
            );
            connectorPointer.lookAt(patch.alignBase);
            connectorPointer.position.add(patch.alignBase.clone().multiplyScalar(0.1));

            patchGroup.add(connectorPointer);

            const nPoints = 4;
            for (let i=0; i<nPoints; i++) {
                let diff = patch.alignDir.clone().multiplyScalar(0.25);
                diff.applyAxisAngle(patch.dir, i * 2*Math.PI/nPoints);
                linePoints.push(
                    patch.pos.clone().sub(patch.dir.clone().multiplyScalar(0.2)).add(diff)
                );
            }

            patchGroup.children.forEach(c=>{
                c.position.sub(patch.dirBase.clone().multiplyScalar(0.1));
            });

            patchGroup.applyQuaternion(patch.q);
            patchGroup.position.copy(patch.pos);
            this.patchObjects.push(patchGroup);
            patchGroup['patch'] = this.rule[ruleIdx][i];

            particle.add(patchGroup);
        });

        let particleGeometry = new ConvexGeometry(linePoints);
        let particleObject = new THREE.Mesh(particleGeometry, this.particleMaterials[ruleIdx]);

        particle.add(particleObject);

        particle.applyQuaternion(q);
        particle.position.copy(position);
        particle.name = "Particle";
        this.objGroup.add(particle);
    }

}
