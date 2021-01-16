var camera, scene, renderer;
var plane;
var mouse, raycaster;

var rollOverMesh, rollOverMaterial;
var cubeGeo, cubeMaterial;

var objects = [];

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

function getCoordinateFile() {
    saveString(
        getCurrentCoords().map(p=>{return `(${p.x},${p.y},${p.z})`}).join('\n'), 
        'coords.txt'
    );
}

function getCurrentCoords() {
    return scene.children.flatMap(
        c => c.name == 'voxel' ? 
        c.position.clone() : []
    );
}

function init() {

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(10, 16, 26);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // roll-over helpers
    var rollOverGeo = new THREE.BoxBufferGeometry(1, 1, 1);
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
        color: 0xfeb74c
    });

    // grid
    var gridHelper = new THREE.GridHelper(20, 20);
    //gridHelper.rotateX(Math.PI/2);
    scene.add(gridHelper);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    var geometry = new THREE.PlaneBufferGeometry(20, 20);
    geometry.rotateX(-Math.PI / 2);

    plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({visible: false}));
    scene.add(plane);

    objects.push(plane);

    // lights

    var ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    var directionalLight = new THREE.DirectionalLight(0xffffff);
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

    var intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) {
        var intersect = intersects[0];
        rollOverMesh.position.copy(intersect.point);
        if (intersect.object.name == 'voxel' && ! event.shiftKey) {
            rollOverMesh.position.add(intersect.face.normal);
        }
        rollOverMesh.position.divideScalar(1).floor().multiplyScalar(1).addScalar(.5);
    }
    render();
}

function onDocumentMouseDown(event) {
    if (event.button == 0) {
        event.preventDefault();
        mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
        raycaster.setFromCamera(mouse, camera);
        var intersects = raycaster.intersectObjects(objects);
        if (intersects.length > 0) {
            var intersect = intersects[0];

            // delete cube
            if (event.shiftKey) {
                if (intersect.object !== plane) {
                    scene.remove(intersect.object);
                    objects.splice(objects.indexOf(intersect.object), 1);
                }

            // create cube
            } else {
                var voxel = new THREE.Mesh(cubeGeo, cubeMaterial);
                voxel.position.copy(intersect.point);
                if (intersect.object.name == 'voxel') {
                    voxel.position.add(intersect.face.normal);
                }
                voxel.position.divideScalar(1).floor().multiplyScalar(1).addScalar(.5);
                voxel.name = "voxel";
                scene.add(voxel);
                console.log(voxel.position.clone().subScalar(.5).divideScalar(1).toArray());

                objects.push(voxel);
            }
            render();
        }
    }
}

function render() {
    renderer.render(scene, camera);
}


function smartEnumerate(xMax, yMax) {
    l = []
    for (const x of range(1, xMax+1)) {
        for (const y of range(1, yMax+1)) {
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
        for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
            iterationCount++;
            yield i;
        }
    }
    return iterationCount;
};

function topFromCoords(coords, nDim=3) {
    neigbourDirs = getRuleOrder(nDim)

    bindings = []
    empty = []
    donePairs = []  // Keep track so that only one bond per pair is saved

    // For each position
    coords.forEach((current, i)=> {
        // Enumerate von Neumann neighborhood
        neigbourDirs.forEach((dP,dPi)=>{
            neigbourPos = current.clone().add(dP);
            found = false;
            // Check if curerent neighbor is among the positions
            coords.forEach((other,j)=>{
                if (neigbourPos.equals(other)) {
                    if (!donePairs.includes((j, i))) {
                        bindings.push([
                            // Particle {} patch {} 
                            i, dPi,
                            // with Particle {} patch {}
                            j, dPi + (dPi % 2 == 0 ? 1 : -1)
                        ])
                        donePairs.push([i, j])
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

function findMinimalRule(coords, maxCubeTypes='auto', maxColors='auto', nDim=3, tortionalPatches=true) {
    // Clear status
    document.getElementById('status').innerHTML = '';
    // Never need to check for (const more than the topology can specify
    let [topology, _] = topFromCoords(coords, nDim);
    let [maxNT, maxNC] = countParticlesAndBindings(topology);
    if (maxCubeTypes == 'auto') {
        maxCubeTypes = maxNT;
    }
    if (maxColors == 'auto') {
        maxColors = maxNC;
    }

    let workers = []
    for (const [nCubeTypes, nColors] of smartEnumerate(maxCubeTypes, maxColors)) {
        if (window.Worker) {
            var myWorker = new Worker('js/solveWorker.js');
            workers.push(myWorker)
            myWorker.onmessage = function(e) {
                console.log('Message received from worker');
                let rule = e.data;
                updateStatus(`<b>${nColors} colors and ${nCubeTypes} cube types:</b>`);
                if (rule != 'skipped') {
                    if (rule) {
                        updateStatus(`Found solution: <a href="https://akodiat.github.io/polycubes/?rule=${rule}" target="_blank">${rule}</a>`);
                        workers.forEach(w=>w.terminate());
                        return rule;
                    } else {
                        updateStatus('Sorry, no solution')
                    }
                }
            }
            myWorker.postMessage([coords, nCubeTypes, nColors, nDim, tortionalPatches]);
        }
    }
}

function updateStatus(status, newline=true) {
    console.log(status);
    let e = document.getElementById('status');
    e.innerHTML += newline ? `<p>${status}</p>` : status;
    e.scrollTop = e.scrollHeight;
}
