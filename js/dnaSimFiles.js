
const structMap = new Map([
    ['cube', {
        'path': 'js/resources/cube.oxview',
        'scale': 40,
        'patchPositions': [
            [4620, 6786, 6728, 5549], // Red
            [4405, 6556, 6500, 6442], // Cyan
            [5326, 6844, 5605, 4727], // Yellow
            [5438, 4513, 6672, 6614], // Green
            [5494, 5143, 5661, 5382], // Blue
            [3762, 6384, 7599, 7528], // Magenta
        ]
    }],
    ['square', {
        'path': 'js/resources/square.oxview',
        'scale': 110,
        'patchPositions': [
            [1760,1791,1822,1853,1964,1995,2124,2155,2312,2343,2707,2738,2946,2977,3099,3130,3275,3306,3395,3364],
            [5238,5269,12549,12580,12691,12722,12851,12882,13039,13070,13434,13465,13673,13704,13826,13857,14002,14033,14122,14091],
            [3478,3509,3540,3571,3682,3713,3842,3873,4030,4061,4467,4498,4706,4737,4859,4890,5035,5066,5155,5124],
            [0,31,62,93,204,235,364,395,552,583,989,1020,1228,1259,1381,1412,1557,1588,1677,1646]
        ]
    }],
    [3, 'three'],
]);

function vectorClear(v, clearingV) {
    let clearedV = v.clone()
    for(let i=0; i<3; i++) {
        if (clearingV.getComponent(i) !== 0) {
            clearedV.setComponent(i, 0)
        }
    }
    return clearedV;
}

async function generateOxViewFile({rule=system.rule, name='polycube', assemblyMode='seeded', scale = 1, debugColors=false, allowMismatches=true, shape='cube'}={}) {
    const shapeInfo = structMap.get(shape);
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

    getText(shapeInfo.path).then(shapeStr => {
        for (const [key, c] of system.confMap) {
            const p = system.cubeMap.get(key).multiplyScalar(scale * shapeInfo.scale);
            //const data = await getJSON(shapeInfo.path);
            console.log(`Adding ${shape} at key ${key}`);
            oxSys.addFromJSON(JSON.parse(shapeStr), p, c.q, key, debugColors ? undefined : new THREE.Color(selectColor(c.ruleIdx)));
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

            const pDiff = cA.clone().sub(cB);

            for (const nucIdA of shapeInfo.patchPositions[dirIdxA]) {
                const nucA = oxSys.getNuc(nucIdA, keyA);

                if (nucA.n3 !== undefined && nucA.n5 !== undefined) {
                    console.log(`Nucleotide ${nucIdA} is already connected`);
                    continue;
                }
                const posA = new THREE.Vector3().fromArray(nucA.p);
                const clPosA = vectorClear(posA, pDiff);

                // Find closest sticky end (with same dir) on the other cube
                let minDist = Infinity;
                let closest = shapeInfo.patchPositions[dirIdxA][0];
                for (const nucIdB of shapeInfo.patchPositions[dirIdxB]) {
                    const nucB = oxSys.getNuc(nucIdB, keyB);

                    if (nucB.n3 !== undefined && nucB.n5 !== undefined) {
                        console.log(`Nucleotide ${nucIdB} is already connected`);
                        continue;
                    }
                    const posB = new THREE.Vector3().fromArray(nucB.p);
                    const clPosB = vectorClear(posB, pDiff);
                    const dist = clPosA.distanceTo(clPosB);
                    if (dist < minDist) {
                        minDist = dist;
                        closest = nucIdB;
                    }
                }

                insertHelix(oxSys, nucIdA, keyA, closest, keyB, 
                    `${keyA}-${keyB}(${nucIdA})`,
                    debugColors ? undefined : new THREE.Color(selectColor(color-1))
                );
            }
        }

        oxSys.saveToFile(`${name}.oxview`);

    })
}

// Pre-load helix strings
let helixStr, nickedHelixStr;
getText('js/resources/21bp.oxview').then(str=>helixStr=str);
getText('js/resources/21bp_nicked.oxview').then(str=>nickedHelixStr=str);

function insertHelix(oxSys, nucIdA, keyA, nucIdB, keyB, helixKey, color) {
    const nA = oxSys.getNuc(nucIdA, keyA);
    const nB = oxSys.getNuc(nucIdB, keyB);

    const pA = new THREE.Vector3().fromArray(nA.p);
    const pB = new THREE.Vector3().fromArray(nB.p);

    console.log(`Adding connecting helix with key ${helixKey}`);

    const p = pA.clone().add(pB).divideScalar(2);
    const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0,0,-1), pB.clone().sub(pA).normalize()
    );
    oxSys.addFromJSON(JSON.parse(helixStr), p, q, helixKey, color, true);

    if (color === undefined) {
        const [sA, _nA] = oxSys.findById(oxSys.idMaps.get(helixKey).get(41));
        const cA = oxSys.getNuc(nucIdA, keyA).color;
        sA.monomers.forEach(n=>{n.color=cA});
        const [sB, _nB] = oxSys.findById(oxSys.idMaps.get(helixKey).get(0));
        const cB = oxSys.getNuc(nucIdB, keyB).color;
        sB.monomers.forEach(n=>{n.color=cB});
    }

    const hA = oxSys.getNuc(41, helixKey); // Strand 1, 5'
    const hB = oxSys.getNuc(0, helixKey);  // Strand 0, 5'

    if (nA.n3 === undefined && nB.n3 === undefined) {
        // Connect two 3' ends to 5' ends of inserted helix
        oxSys.ligate(hA.id, nA.id);
        oxSys.ligate(hB.id, nB.id);
    } else if (nA.n5 === undefined && nB.n5 === undefined) {
        // Connect two 5' ends to e' ends of inserted helix
        oxSys.ligate(hA.bp, nA.id);
        oxSys.ligate(hB.bp, nB.id);
    } else if (nA.n3 === undefined && nB.n5 === undefined) {
        oxSys.nick(oxSys.getNuc(10, helixKey).id);
        // Connect 3' end nA to one 5' end of inserted helix
        oxSys.ligate(hA.id, nA.id);
        // Connect 5' end nB to one 3' end of inserted helix
        oxSys.ligate(hB.bp, nB.id);
    } else if (nA.n5 === undefined && nB.n3 === undefined) {
        oxSys.nick(oxSys.getNuc(10, helixKey).id);
        // Connect 5' end nA to one 3' end of inserted helix
        oxSys.ligate(hA.bp, nA.id);
        // Connect 3' end nB to one 5' end of inserted helix
        oxSys.ligate(hB.id, nB.id);
    } else {
        console.log(`${nA.n5} -> ${nA.id} -> ${nA.n3}`);
        console.log(`${nB.n5} -> ${nB.id} -> ${nB.n3}`);
        console.error("Not sure how you want me to connect these helices");
    }
}

async function getText(path) {
    return fetch(path)
        .then((response)=>response.text())
        .then((responseStr)=>{
            return responseStr
        });
}

async function getJSON(path) {
    return fetch(path)
        .then((response)=>response.json())
        .then((responseJson)=>{
            return responseJson
        });
}