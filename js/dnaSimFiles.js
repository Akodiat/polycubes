
async function generateOxViewFile({rule, name='polycube', assemblyMode='seeded', scale = 40, debugColors=false, allowMismatches=true}={}) {
    if (rule === undefined) {
        rule = system.rule;
    }
    let sys = new PolycubeSystem(rule, undefined, 100, 100, assemblyMode, true, undefined, allowMismatches);
    sys.seed();
    let processed = false;
    while (!processed) {
        processed = sys.processMoves();
        if (processed == 'oub') {
            console.warn("Getting config for unbounded rule");
            break;
        }
    }

    let oxSys = new OxViewSystem();

    const patchPositions = [
        [4620, 6786, 6728, 5549], // Red
        [4405, 6556, 6500, 6442], // Cyan
        [5326, 6844, 5605, 4727], // Yellow
        [5438, 4513, 6672, 6614], // Green
        [5494, 5143, 5661, 5382], // Blue
        [3762, 6384, 7599, 7528], // Magenta 
    ];

    for (const [key, c] of system.confMap) {
        const p = system.cubeMap.get(key).multiplyScalar(scale);
        const data = await getJSON('js/resources/cube.oxview');
        console.log(`Adding cube with key ${key}`);
        oxSys.addFromJSON(data, p, c.q, key, debugColors ? undefined : new THREE.Color(selectColor(c.ruleIdx)));
    }

    const orientationFromAlignDir = (v, i) => Math.round(getSignedAngle(
        faceRotations[i], v, ruleOrder[i]
    )*(2/Math.PI)+4)%4;

    // Connect cubes together
    for (const c of sys.connections) {
        const [cA, cB, color] = c;
        const keyA = vecToStr(cA);
        const keyB = vecToStr(cB);

        // Find original orientations
        const qA = sys.confMap.get(keyA).q.clone().invert();
        const patchDirA = cB.clone().sub(cA).applyQuaternion(qA).normalize();
        const dirIdxA = ruleOrder.findIndex(e=>patchDirA.distanceTo(e)<1e-5);

        const qB = sys.confMap.get(keyB).q.clone().invert();
        const patchDirB = cA.clone().sub(cB).applyQuaternion(qB).normalize();
        const dirIdxB = ruleOrder.findIndex(e=>patchDirB.distanceTo(e)<1e-5);

        const oA = orientationFromAlignDir(sys.rule[sys.confMap.get(keyA).ruleIdx][dirIdxA].alignDir, dirIdxA);
        const oB = orientationFromAlignDir(sys.rule[sys.confMap.get(keyB).ruleIdx][dirIdxB].alignDir, dirIdxB);

        for (let i=0; i<4; i++) {
            const nucIdA = patchPositions[dirIdxA][(4+i - oA) % 4];
            const nucIdB = patchPositions[dirIdxB][(4-i - oB + 2) % 4];
            await insertHelix(oxSys, nucIdA, keyA, nucIdB, keyB, 
                `${keyA}-${keyB}(${i})`,
                debugColors ? undefined : new THREE.Color(selectColor(color-1))
            );
        }
    }

    oxSys.saveToFile(`${name}.oxview`);
}

async function insertHelix(oxSys, nucIdA, keyA, nucIdB, keyB, helixKey, color) {
    const helix = await getJSON('js/resources/21bp.oxview');

    let nA = oxSys.getNuc(nucIdA, keyA);
    let nB = oxSys.getNuc(nucIdB, keyB);

    let pA = new THREE.Vector3().fromArray(nA.p);
    let pB = new THREE.Vector3().fromArray(nB.p);

    console.log(`Adding connecting helix with key ${helixKey}`);

    let p = pA.clone().add(pB).divideScalar(2);
    let q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0,0,-1), pB.clone().sub(pA).normalize()
    );
    oxSys.addFromJSON(helix, p, q, helixKey, color);

    if (color === undefined) {
        let [sA, _nA] = oxSys.findById(oxSys.idMaps.get(helixKey).get(41));
        const cA = oxSys.getNuc(nucIdA, keyA).color;
        sA.monomers.forEach(n=>{n.color=cA});
        let [sB, _nB] = oxSys.findById(oxSys.idMaps.get(helixKey).get(0));
        const cB = oxSys.getNuc(nucIdB, keyB).color;
        sB.monomers.forEach(n=>{n.color=cB});
    }

    oxSys.ligate(
        oxSys.idMaps.get(helixKey).get(41),
        oxSys.idMaps.get(keyA).get(nucIdA)
    );

    oxSys.ligate(
        oxSys.idMaps.get(helixKey).get(0),
        oxSys.idMaps.get(keyB).get(nucIdB)
    );
}

async function getJSON(path) {
    return fetch(path)
        .then((response)=>response.json())
        .then((responseJson)=>{
            return responseJson
        });
}