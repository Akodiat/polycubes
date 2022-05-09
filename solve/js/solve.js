let camera, scene, renderer;
let mouse, raycaster;

let rollOverMesh, rollOverMaterial;
let cubeGeo, cubeMaterial;
let connectorGeo, connectoryMaterial;

let CamPos3D;
let CamFov3D;

let voxels = new Set();
let connectors = new Map();

init();
render();


function saveString(text, filename) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function posToString(p) {
    return `[${p.toArray().toString()}]`;
}

function connectionToString(p1, p2) {
    [s1, s2] = [p1, p2].map(p=>posToString(p)).sort();
    return `[${s1}, ${s2}]`
}

function getCoordinateFile() {
    saveString(
        getCurrentCoords().map(p=>{return `(${p.x},${p.y},${p.z})`}).join('\n'), 
        'coords.txt'
    );
}

function saveSolveSpec() {
    const nDim = document.getElementById("2d").checked ? 2:3;
    let [topology, _] = getCurrentTop(nDim);
    let out = {
        nDim: nDim,
        bindings: topology,
        torsion: document.getElementById("torsionalPatches").checked,
        stopAtFirst: document.getElementById("stopAtFirstSol").checked
    };
    saveString(
        JSON.stringify(out),
        'polysat.json'
    );
}

function loadSolveSpec(solveSpec) {
    // If we just have a default cube, remove it
    if (voxels.size == 1 && [...voxels][0].position.equals(new THREE.Vector3())) {
        let d = [...voxels][0];
        scene.remove(d);
        voxels.delete(d);
    }
    // Load settings
    switch (solveSpec.nDim) {
        case 2: document.getElementById("2d").checked = true; break;
        case 3: document.getElementById("2d").checked = false; break;
        default:
            console.warn(`Invalid nDim: ${solveSpec.nDim}, should be 2 or 3`);
            break;
    }
    document.getElementById("torsionalPatches").checked = solveSpec.torsion;
    document.getElementById("stopAtFirstSol").checked = solveSpec.stopAtFirst;

    let coordMap = new Map();
    coordMap.set(0, new THREE.Vector3());
    let processedBindings = new Set();
    while (processedBindings.size < solveSpec.bindings.length) {
        for (const [i, dPi, j, dPj] of solveSpec.bindings) {
            const key = `${i}.${j}`;
            if (!processedBindings.has(key)) {
                console.assert(ruleOrder[dPi].clone().negate().equals(ruleOrder[dPj]), "Odd binding");
                if(coordMap.has(i) && coordMap.has(j)) {
                    console.assert(
                        coordMap.get(i).clone().add(ruleOrder[dPi]).equals(coordMap.get(i)),
                        "Non-eucledian bindings!"
                    );
                } else if (coordMap.has(i)) {
                    coordMap.set(j, coordMap.get(i).clone().add(ruleOrder[dPi]))
                } else if (coordMap.has(j)) {
                    coordMap.set(i, coordMap.get(j).clone().sub(ruleOrder[dPi]))
                } else {
                    console.log("should only print once");
                    continue;
                }
                processedBindings.add(key);
            }
        }
    }
    let center = new THREE.Vector3();
    let ncoords = 0;
    for (const x of coordMap.values()) {
        center.add(x);
        ncoords++;
    }
    center.divideScalar(ncoords).round();
    for (const x of coordMap.values()) {
        x.sub(center);
    }
    for (const x of coordMap.values()) {
        let voxel = new THREE.Mesh(cubeGeo, cubeMaterial);
        voxel.position.copy(x);
        voxel.name = "voxel";
        let existing = false;
        for (const v of voxels) {
            if (v.position.equals(voxel.position)) {
                console.log("Position already set");
                voxel = v;
                existing = true;
                break;
            }
        }
        if (!existing) {
            scene.add(voxel);
            console.log(voxel.position.toArray());
            voxels.add(voxel);
        }
    }

    for (const [i, dPi, j, dPj] of solveSpec.bindings) {
        let c1 = coordMap.get(i);
        let c2 = coordMap.get(j);
        let cs = connectionToString(c1, c2);
        if (!connectors.has(cs)) {
            let connector = new THREE.Mesh(connectorGeo, connectoryMaterial);
            connector.position.copy(c1.clone().add(c2).divideScalar(2));
            connector.lookAt(c2);
            scene.add(connector);
            connectors.set(cs, connector);
        }
    }
}

function handleFile(file=document.getElementById('load').files[0]) {
    new Response(file).json().then(json => {
        loadSolveSpec(json);
      }, err => {
        console.error("Could not read file: "+error);
    });
}

function handleDrop(ev) {
    ev.preventDefault();

    if (ev.dataTransfer.items) {
        for (const item of ev.dataTransfer.items) {
            if (item.kind === 'file') {
                handleFile(item.getAsFile());
            }
        }
    } else {
        for (const file of ev.dataTransfer.files) {
            handleFile(file);
        }
    }
}

function handleDragOver(ev) {
    console.log('File(s) in drop zone');

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
}

function drawSolidCube(side, origin = new THREE.Vector3()) {
    coords = []
    for (x of range(side)) {
        for (y of range (side)) {
            for (z of range (side)) {
                coords.push(new THREE.Vector3(x,y,z))
            }
        }
    }
    drawFromCoords(coords, origin);
}

function drawFromCoords(coords, origin = new THREE.Vector3()) {
    let neigbourDirs = getRuleOrder(3);

    for (x of coords) {
        let voxel = new THREE.Mesh(cubeGeo, cubeMaterial);
        voxel.position.copy(x).add(origin);
        voxel.name = "voxel";
        let existing = false;
        for (const v of voxels) {
            if (v.position.equals(voxel.position)) {
                console.log("Position already set");
                voxel = v;
                existing = true;
                break;
            }
        }
        if (!existing) {
            scene.add(voxel);
            console.log(voxel.position.toArray());
            voxels.add(voxel);
        }

        // Enumerate von Neumann neighborhood
        for (dP of neigbourDirs) {
            let neigbourPos = voxel.position.clone().add(dP);
            // Check if curerent neighbor is among the positions
            for (other of coords) {
                if (neigbourPos.equals(other)) {
                    let c1 = voxel.position;
                    let c2 = neigbourPos;
                    let cs = connectionToString(c1, c2);
                    if (!connectors.has(cs)) {
                        let connector = new THREE.Mesh(connectorGeo, connectoryMaterial);
                        connector.position.copy(c1.clone().add(c2).divideScalar(2));
                        connector.lookAt(c2);
                        scene.add(connector);
                        connectors.set(cs, connector);
                    }
                }
            }
        }
    }
    render();
}


function getFullyAdressableRule() {
    let rule = [];
    let cubePosMap = new Map();
    let coords = getCurrentCoords();

    // Find which dimension has the fewest connectors
    let dimCount = [0,0,0];
    let dims = [
        new THREE.Vector3(1,0,0),
        new THREE.Vector3(0,1,0),
        new THREE.Vector3(0,0,1)
    ];
    coords.forEach(p => {
        ruleOrder.forEach(dir => {
            let neigbourPos = p.clone().add(dir);
            if (connectors.has(`[${posToString(p)}, ${posToString(neigbourPos)}]`)) {
                for (let i=0; i<3; i++) {
                    if (vectorAbs(dir).equals(dims[i])) {
                        dimCount[i]++;
                        break;
                    }
                }
            }
        });
    });
    let minCount = Math.min(...dimCount);
    let minDim = dims.find((d,i)=>dimCount[i]===minCount);

    // Initialise empty cube typess
    coords.forEach((p,iCube) => {
        let cubeType = [];
        faceRotations.forEach((d,i)=>{
            let alignDir = d;
            if (!vectorAbs(ruleOrder[i]).equals(minDim)) {
                alignDir=minDim;
            }
            cubeType.push({color: 0, alignDir: alignDir});
        });
        rule.push(cubeType);
        cubePosMap.set(posToString(p), iCube);
    });
    let colorCounter = 1;
    coords.forEach((p, iCube) => {
        ruleOrder.forEach((dir, iFace)=>{
            let neigbourPos = p.clone().add(dir);
            if (connectors.has(`[${posToString(p)}, ${posToString(neigbourPos)}]`)) {
                const invDir = dir.clone().negate();
                const iFaceNeigh = ruleOrder.findIndex(f=>invDir.equals(f));
                const iCubeNeigh = cubePosMap.get(posToString(neigbourPos));

                rule[iCube][iFace].color = colorCounter;
                rule[iCubeNeigh][iFaceNeigh].color = -colorCounter;
                rule[iCubeNeigh][iFaceNeigh].alignDir = rule[iCube][iFace].alignDir;

                colorCounter++;
            }
        })
    });
    return rule;
}

function getCurrentCoords() {
    return [...voxels].map(v=>v.position);
}

function init() {
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(2, 3, 5);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();

    // roll-over helpers
    let rollOverGeo = new THREE.BoxBufferGeometry(.5, .5, .5);
    rollOverMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        opacity: 0.5,
        transparent: true
    });
    rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
    scene.add(rollOverMesh);

    // cubes
    cubeGeo = new THREE.BoxBufferGeometry(.75, .75, .75);
    cubeMaterial = new THREE.MeshLambertMaterial({
        color: 0x444444
    });

    // cubes
    connectorGeo = new THREE.BoxBufferGeometry(.45, .45, 1);
    connectoryMaterial = new THREE.MeshLambertMaterial({
        color: 0xfe004c
    });

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // lights

    let ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    let directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    scene.add(directionalLight);

    canvas = document.getElementById("threeCanvas");
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: canvas,
        alpha: true,
        preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);

    document.body.appendChild(renderer.domElement);

    canvas.addEventListener('mousemove', onDocumentMouseMove, false);
    canvas.addEventListener('mousedown', onDocumentMouseDown, false);

    window.addEventListener('resize', onWindowResize, false);

    document.addEventListener("keydown", event => {
        if (event.key == 's' && event.ctrlKey) {
            event.preventDefault();
            this.getCoordinateFile();
        }
    });

    // orbit controls
    orbit = new THREE.OrbitControls(camera, canvas);
    orbit.damping = 0.2;
    orbit.addEventListener('change', render);

    let voxel = new THREE.Mesh(cubeGeo, cubeMaterial);
    scene.add(voxel);
    voxels.add(voxel);

    CamPos3D = new THREE.Vector3(5, 8, 13);
    CamFov3D = 45;
    toggle2DCamera();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function largestComponent(v) {
    if (Math.abs(v.x) >= Math.abs(v.y) && Math.abs(v.x) >= Math.abs(v.z)) {
        return new THREE.Vector3(1,0,0).multiplyScalar(Math.sign(v.x));
    }
    if (Math.abs(v.y) >= Math.abs(v.x) && Math.abs(v.y) >= Math.abs(v.z)) {
        return new THREE.Vector3(0,1,0).multiplyScalar(Math.sign(v.y));
    }
    if (Math.abs(v.z) >= Math.abs(v.y) && Math.abs(v.z) >= Math.abs(v.x)) {
        return new THREE.Vector3(0,0,1).multiplyScalar(Math.sign(v.z));
    }
}

function toggle2DCamera() {
    const is2d = document.getElementById("2d").checked;
    if (is2d) {
        camera.fov = 1/100;
        camera.zoom = 1/1000;
        CamPos3D.copy(camera.position);
        camera.position.x = 0;
        camera.position.y = 0;
    } else {
        camera.fov = CamFov3D;
        camera.zoom = 1;
        camera.position.copy(CamPos3D);
    }
    camera.lookAt(new THREE.Vector3());
    camera.updateProjectionMatrix();
    render();
}

function onDocumentMouseMove(event) {
    event.preventDefault();
    mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);

    let intersects = raycaster.intersectObjects([...voxels]);
    if (intersects.length > 0) {
        rollOverMesh.visible = true;
        let intersect = intersects[0];
        rollOverMesh.position.copy(intersect.object.position);
        if (event.shiftKey) {
            rollOverMesh.scale.setScalar(2);
        } else {
            rollOverMesh.scale.setScalar(1);
            if (document.getElementById("2d").checked) {
                const dir = intersect.point.clone().sub(intersect.object.position);
                dir.z = 0;
                rollOverMesh.position.add(largestComponent(dir).divideScalar(2));
            } else {
                rollOverMesh.position.add(intersect.face.normal.clone().divideScalar(2));
            }
        }
    } else {
        rollOverMesh.visible = false;
    }
    render();
}

function onDocumentMouseDown(event) {
    if (event.button == 0) {
        event.preventDefault();
        mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
        raycaster.setFromCamera(mouse, camera);
        let intersects = raycaster.intersectObjects([...voxels]);
        if (intersects.length > 0) {
            let i = intersects[0];

            // delete cube
            if (event.shiftKey) {
                if (voxels.size > 1) {
                    // Remove cube
                    scene.remove(i.object);
                    voxels.delete(i.object);
                    // Remove connectors
                    let connectorsToRemove = [];
                    connectors.forEach((c,s)=>{
                        if(s.includes(posToString(i.object.position))) {
                            connectorsToRemove.push([c,s]);
                        }
                    })
                    console.log(`Removing ${connectorsToRemove.length} connectors: ${connectorsToRemove.map(c=>c[1])}`)
                    connectorsToRemove.forEach(i=>{
                        [c,s] = i;
                        scene.remove(c);
                        connectors.delete(s);
                    });
                }
            // create cube
            } else {
                let voxel = new THREE.Mesh(cubeGeo, cubeMaterial);
                voxel.position.copy(i.object.position);
                const is2d = document.getElementById("2d").checked;
                if (is2d) {
                    const dir = i.point.clone().sub(i.object.position);
                    dir.z = 0;
                    voxel.position.add(largestComponent(dir));
                } else {
                    voxel.position.add(i.face.normal);
                }
                voxel.name = "voxel";
                let existing = false;
                for (let v of voxels) {
                    if (v.position.equals(voxel.position)) {
                        console.log("Position already set");
                        voxel = v;
                        existing = true;
                        break;
                    }
                }
                if (!existing) {
                    scene.add(voxel);
                    console.log(voxel.position.toArray());
                    voxels.add(voxel);
                }

                // Add connector, unless we are drawing in third dimension
                // when we shouldn't
                let c1 = voxel.position.clone();
                let c2 = i.object.position.clone();
                if(!is2d || !c1.equals(c2)) {
                    let cs = connectionToString(c1, c2);
                    if (!connectors.has(cs)) {
                        let connector = new THREE.Mesh(connectorGeo, connectoryMaterial);
                        connector.position.copy(c1.clone().add(c2).divideScalar(2));
                        connector.lookAt(c2);
                        scene.add(connector);
                        connectors.set(cs, connector);
                    }
                }
            }
            render();
        }
    }
}

function render() {
    renderer.render(scene, camera);
}


function smartEnumerate(xMax, yMax, xMin=1, yMin=1) {
    l = []
    for (const x of range(xMin, xMax+1)) {
        for (const y of range(yMin, yMax+1)) {
            l.push([x,y])
        }
    }
    return l.sort((a,b)=>{return (a[0]+a[1]) - (b[0]+b[1])})
}

// Modified from https://stackoverflow.com/a/8273091
function* range(start, stop, step) {
    if (typeof stop == 'undefined') {
        stop = start;
        start = 0;
    }
    if (typeof step == 'undefined') {
        step = 1;
    }
    let iterationCount = 0;
    if (!((step > 0 && start >= stop) || (step < 0 && start <= stop))) {
        for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
            iterationCount++;
            yield i;
        }
    }
    return iterationCount;
};

function getCurrentTop(nDim=3) {
    let neigbourDirs = getRuleOrder(nDim);
    let bindings = [];
    let empty = [];
    let donePairs = [];  // Keep track so that only one bond per pair is saved
    let connectionStrs = [...connectors.keys()];
    let coords = getCurrentCoords();
    coords.forEach((current, i)=>{
        // Enumerate von Neumann neighborhood
        neigbourDirs.forEach((dP,dPi)=>{
            neigbourPos = current.clone().add(dP);
            if (connectionStrs.includes(connectionToString(current, neigbourPos))) {
                let j = coords.findIndex(c=>c.equals(neigbourPos));
                if (j<0) {
                    throw `${neigbourPos} not in coordinates (${coords})`;
                }
                if (!donePairs.includes([i,j].sort().toString())) {
                    bindings.push([
                        // Particle {} patch {} 
                        i, dPi,
                        // with Particle {} patch {}
                        j, dPi + (dPi % 2 == 0 ? 1 : -1)
                    ]);
                    //console.log(`Particle ${i} patch ${dPi} with particle ${j} patch ${dPi + (dPi % 2 == 0 ? 1 : -1)}`);
                    donePairs.push([i,j].sort().toString())
                }
            } else {
                empty.push([i, dPi]);
            }
        });
    });
    return [bindings, empty]
}

function topFromCoords(coords, nDim=3) {
    let neigbourDirs = getRuleOrder(nDim);

    let bindings = [];
    let empty = [];
    let donePairs = [];  // Keep track so that only one bond per pair is saved

    // For each position
    coords.forEach((current, i)=> {
        // Enumerate von Neumann neighborhood
        neigbourDirs.forEach((dP,dPi)=>{
            neigbourPos = current.clone().add(dP);
            found = false;
            // Check if curerent neighbor is among the positions
            coords.forEach((other,j)=>{
                if (neigbourPos.equals(other)) {
                    if (!donePairs.includes([i,j].sort().toString())) {
                        bindings.push([
                            // Particle {} patch {} 
                            i, dPi,
                            // with Particle {} patch {}
                            j, dPi + (dPi % 2 == 0 ? 1 : -1)
                        ])
                        console.log(`Particle ${i} patch ${dPi} with particle ${j} patch ${dPi + (dPi % 2 == 0 ? 1 : -1)}`)
                        donePairs.push([i,j].sort().toString())
                    }
                    found = true;
                }
            });
            // If the current neigbour is empty, save
            if (!found) {
                empty.push([i, dPi])
            }
        });
    });
    return [bindings, empty]
}

function getRuleOrder() {
    return [
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3( 1, 0, 0),
        new THREE.Vector3( 0,-1, 0),
        new THREE.Vector3( 0, 1, 0),
        new THREE.Vector3( 0, 0,-1),
        new THREE.Vector3( 0, 0, 1),
    ]
}

function countParticlesAndBindings(topology) {
    pidsa = topology.map(x=>x[0]);
    pidsb = topology.map(x=>x[2]);
    particles = pidsa.concat(pidsb);
    return [Math.max(...particles)+1, topology.length]
}

function findMinimalRuleFromSettings() {
    const nDim = document.getElementById("2d").checked ? 2:3;
    const torsionalPatches = document.getElementById("torsionalPatches").checked;
    findMinimalRule(nDim, torsionalPatches);
}

function findMinimalRule(nDim=3, torsionalPatches=true) {
    // Clear status
    document.getElementById('status').innerHTML = '';
    let maxCubeTypes = document.getElementById('maxNt').valueAsNumber;
    let maxColors = document.getElementById('maxNc').valueAsNumber;
    let minCubeTypes = document.getElementById('minNt').valueAsNumber;
    let minColors = document.getElementById('minNc').valueAsNumber;

    // Never need to check for more than the topology can specify
    // Calc fully adressable rule:
    const fullyAdressable = getFullyAdressableRule();
    let [topology, _] = getCurrentTop(nDim);
    let [maxNT, maxNC] = countParticlesAndBindings(topology);
    updateStatus({status:'✓', rule: ruleToDec(fullyAdressable)}, maxNT, maxNC);

    // Try to simplify:
    let simplifyWorker = new Worker('js/simplifyWorker.js');
    simplifyWorker.onmessage = function(e) {
        const simplified = e.data;
        const simplifiedRule = parseDecRule(simplified);
        const nCubeTypes = getNt(simplifiedRule);
        const nColors = getNc(simplifiedRule);
        updateStatus({status:'✓', rule: simplified}, nCubeTypes, nColors);
        globalBest = Math.min(globalBest, nCubeTypes+nColors);
    }
    simplifyWorker.postMessage(ruleToDec(fullyAdressable));

    maxCubeTypes = maxCubeTypes < 0 ? maxNT: Math.min(maxNT, maxCubeTypes);
    maxColors = maxColors < 0 ? maxNC: Math.min(maxNC, maxColors);

    workers = [];
    let stopButton = document.getElementById("stopButton");
    stopButton.onclick = ()=>{
        workers.forEach(w=>{
            w.terminate();
            updateStatus({status:'↛'}, w.nCubeTypes, w.nColors);
        });
        stopButton.style.visibility = 'hidden'
    };
    queue = smartEnumerate(maxCubeTypes, maxColors, minCubeTypes, minColors);
    const nConcurrent = 4;
    globalBest = Infinity;
    if (window.Worker) {
        while (workers.length < nConcurrent) {
            if (queue.length > 0) {
                startNewWorker(nDim, torsionalPatches);
            } else {
                break;
            }
        }
    }
}

let globalBest;
let queue, workers;
function startNewWorker(nDim=3, torsionalPatches=true) {
    const [nCubeTypes, nColors] = queue.shift(); // Get next params

    updateStatus({status:'...'}, nCubeTypes, nColors);

    //updateStatus('...', nCubeTypes, nColors);
    let [topology, empty] = getCurrentTop(nDim);
    console.log("Starting worker for "+nCubeTypes+" and "+nColors);
    let myWorker = new Worker('js/solveWorker.js');
    myWorker.nCubeTypes = nCubeTypes;
    myWorker.nColors = nColors;
    workers.push(myWorker);
    myWorker.onmessage = function(e) {
        let result = e.data;
        updateStatus(result, nCubeTypes, nColors);
        if (result.status == '✓' && document.getElementById('stopAtFirstSol').checked) {
            globalBest = Math.min(globalBest, nCubeTypes+nColors);
            workers.forEach(w=>{
                if (w.nCubeTypes + w.nColors > globalBest) {
                    updateStatus({status:'↛'}, w.nCubeTypes, w.nColors);
                    w.terminate();
                    console.log(`Skipping ${nColors} colors and ${nCubeTypes} cube types`)
                }
            });
            filterInPlace(workers, w=>(w.nCubeTypes + w.nColors <= globalBest));
            filterInPlace(queue, p=>(p[0] + p[1] <= globalBest));
        }
        if (queue.length > 0) {
            startNewWorker(nDim, torsionalPatches);
        }
        myWorker.terminate();
        filterInPlace(workers, w=>w!=myWorker); // Remove from workers
        console.log(`${nColors} colors and ${nCubeTypes} cube types completed. ${queue.length} in queue`);
    }
    myWorker.postMessage([topology, empty, nCubeTypes, nColors, nDim, torsionalPatches]);
}

// https://stackoverflow.com/a/37319954
function filterInPlace(a, condition) {
    let i = 0, j = 0;
  
    while (i < a.length) {
      const val = a[i];
      if (condition(val, i, a)) a[j++] = val;
      i++;
    }
  
    a.length = j;
    return a;
  }

function updateStatus(result, nCubeTypes, nColors) {
    let captions = {
        '✓': `Satisfiable for ${nCubeTypes} cube types and ${nColors} colors`,
        '∞': `Satisfiable for ${nCubeTypes} cube types and ${nColors} colors, but will also assemble into unbounded shapes`,
        '?': `Satisfiable for ${nCubeTypes} cube types and ${nColors} colors, but will also assemble into other shapes`,
        '×': `Not satisfiable for ${nCubeTypes} cube types and ${nColors} colors`,
        '...': `Working on it...`,
        '↛': 'Skipped'
    }
    let colors = {
        '✓': 'rgba(126, 217, 118, 0.6)',
        '∞': 'rgba(39, 61, 128, 0.6)',
        '?': 'rgba(39, 61, 128, 0.6)',
        '×': 'rgba(208, 47, 47, 0.6)',
        '...': 'rgba(50, 50, 50, 0.4)',
        '↛': 'rgba(50, 50, 50, 0.4)'
    }
    let table = document.getElementById('status');
    while (table.rows.length < nCubeTypes+1) {
        table.insertRow();
    }
    while (table.rows[0].cells.length < nColors+1) {
        let c = document.createElement("th");
        table.rows[0].appendChild(c);
        if (table.rows[0].cells.length != 1) {
            c.innerHTML = 'N<sub>c</sub>='+(table.rows[0].cells.length-1);
        }
    }
    let row = table.rows[nCubeTypes];
    if (row.cells.length == 0) {
        let c = document.createElement("th");
        row.appendChild(c);
        c.innerHTML = 'N<sub>t</sub>='+nCubeTypes;
    }
    while (row.cells.length < nColors+1) {
        row.insertCell();
    }
    let cell = row.cells[nColors];
    if (result.rule) {
        cell.innerHTML = `<a href="../?assemblyMode=stochastic&decRule=${result.rule}" target="_blank">${result.status}</a>`;
    } else if (result.status == '...') {
        cell.innerHTML = '<div class="busy">...</div>';
    } else {
        cell.innerHTML = result.status;
    }
    cell.title = captions[result.status];
    cell.style.background = colors[result.status];
}
