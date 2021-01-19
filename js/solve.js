let camera, scene, renderer;
let mouse, raycaster;

let rollOverMesh, rollOverMaterial;
let cubeGeo, cubeMaterial;
let connectorGeo, connectoryMaterial;

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

    //

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
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
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
            rollOverMesh.position.add(intersect.face.normal.clone().divideScalar(2));
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
                voxel.position.copy(i.object.position)
                voxel.position.add(i.face.normal);
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
                let c1 = voxel.position.clone();
                let c2 = i.object.position.clone();
                let cs = connectionToString(c1, c2);
                if (!connectors.has(cs)) {
                    let connector = new THREE.Mesh(connectorGeo, connectoryMaterial);
                    connector.position.copy(c1.clone().add(c2).divideScalar(2));
                    connector.lookAt(c2);
                    scene.add(connector);
                    connectors.set(cs, connector);
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
                    console.log(`Particle ${i} patch ${dPi} with particle ${j} patch ${dPi + (dPi % 2 == 0 ? 1 : -1)}`);
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

function getRuleOrder(nDim=3) {
    if (nDim == 2) {
        return [
            new THREE.Vector2(0, -1),
            new THREE.Vector2(1, 0),
            new THREE.Vector2(0, 1),
            new THREE.Vector2(-1, 0)
        ]
    }
    else {    
        return [
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3( 1, 0, 0),
            new THREE.Vector3( 0,-1, 0),
            new THREE.Vector3( 0, 1, 0),
            new THREE.Vector3( 0, 0,-1),
            new THREE.Vector3( 0, 0, 1),
        ]
    }
}

function countParticlesAndBindings(topology) {
    pidsa = topology.map(x=>x[0]);
    pidsb = topology.map(x=>x[2]);
    particles = pidsa.concat(pidsb);
    return [Math.max(...particles)+1, topology.length]
}

function findMinimalRule(nDim=3, tortionalPatches=true) {
    // Clear status
    document.getElementById('status').innerHTML = '';
    let maxCubeTypes = document.getElementById('maxNt').valueAsNumber;
    let maxColors = document.getElementById('maxNc').valueAsNumber;
    let minCubeTypes = document.getElementById('minNt').valueAsNumber;
    let minColors = document.getElementById('minNc').valueAsNumber;

    // Never need to check for more than the topology can specify
    let [topology, _] = getCurrentTop(nDim);
    let [maxNT, maxNC] = countParticlesAndBindings(topology);
    maxCubeTypes = maxCubeTypes < 0 ? maxNT: Math.min(maxNT, maxCubeTypes);
    maxColors = maxColors < 0 ? maxNC: Math.min(maxNC, maxColors);

    let workers = [];
    let stopButton = document.getElementById("stopButton");
    stopButton.onclick = ()=>{
        workers.forEach(w=>w.terminate());
        stopButton.style.visibility = 'hidden'
    };
    let queue = smartEnumerate(maxCubeTypes, maxColors, minCubeTypes, minColors);
    const nConcurrent = 4;
    if (window.Worker) {
        while (workers.length < nConcurrent) {
            if (queue.length > 0) {
                startNewWorker(queue, workers, nDim, tortionalPatches);
            } else {
                break;
            }
        }
    }
}

function startNewWorker(queue, workers, nDim=3, tortionalPatches=true) {
    const [nCubeTypes, nColors] = queue.shift(); // Get next params
    //updateStatus('...', nCubeTypes, nColors);
    let [topology, empty] = getCurrentTop(nDim);
    console.log("Starting worker for "+nCubeTypes+" and "+nColors);
    let myWorker = new Worker('js/solveWorker.js');
    workers.push(myWorker);
    myWorker.onmessage = function(e) {
        console.log(`${nColors} colors and ${nCubeTypes} cube types completed. ${queue.length} in queue`);
        let result = e.data;
        updateStatus(result, nCubeTypes, nColors);
        if (result.status == '✓' && document.getElementById('stopAtFirstSol').checked) {
            workers.forEach(w=>w.terminate());
        } else if (queue.length > 0) {
            startNewWorker(queue, workers, nDim, tortionalPatches);
        }
    }
    myWorker.postMessage([topology, empty, nCubeTypes, nColors, nDim, tortionalPatches]);
}

function updateStatus(result, nCubeTypes, nColors) {
    let captions = {
        '✓': `Satisfiable for nT=${nCubeTypes} cube types and nC=${nColors} colors`,
        '∞': `Satisfiable for nT=${nCubeTypes} cube types and nC=${nColors} colors, but will also assemble into unbounded shapes`,
        '?': `Satisfiable for nT=${nCubeTypes} cube types and nC=${nColors} colors, but will also assemble into other shapes`,
        '×': `Not satisfiable for nT=${nCubeTypes} cube types and nC=${nColors} colors`,
    }
    let colors = {
        '✓': 'rgba(126, 217, 118, 0.6)',
        '∞': 'rgba(39, 61, 128, 0.6)',
        '?': 'rgba(39, 61, 128, 0.6)',
        '×': 'rgba(208, 47, 47, 0.6)'
    }
    let table = document.getElementById('status');
    while (table.rows.length < nCubeTypes+1) {
        table.insertRow();
    }
    while (table.rows[0].cells.length < nColors+1) {
        let c = document.createElement("th");
        table.rows[0].appendChild(c);
        if (table.rows[0].cells.length != 1) {
            c.innerHTML = 'nC='+(table.rows[0].cells.length-1);
        }
    }
    let row = table.rows[nCubeTypes];
    if (row.cells.length == 0) {
        let c = document.createElement("th");
        row.appendChild(c);
        c.innerHTML = 'nT='+nCubeTypes;
    }
    while (row.cells.length < nColors+1) {
        row.insertCell();
    }
    let cell = row.cells[nColors];
    if (result.rule) {
        cell.innerHTML = `<a href="https://akodiat.github.io/polycubes/?assemblyMode=stochastic&rule=${result.rule}" target="_blank">${result.status}</a>`;
    } else {
        cell.innerHTML = result.status;
    }
    cell.title = captions[result.status];
    cell.style.background = colors[result.status];
}
