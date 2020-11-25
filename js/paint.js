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
        c.position.clone().subScalar(25).divideScalar(50) : []
    );
}

function init() {

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(500, 800, 1300);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // roll-over helpers
    var rollOverGeo = new THREE.BoxBufferGeometry(50, 50, 50);
    rollOverMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        opacity: 0.5,
        transparent: true
    });
    rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
    scene.add(rollOverMesh);

    // cubes
    cubeGeo = new THREE.BoxBufferGeometry(50, 50, 50);
    cubeMaterial = new THREE.MeshLambertMaterial({
        color: 0xfeb74c
    });

    // grid
    var gridHelper = new THREE.GridHelper(1000, 20);
    //gridHelper.rotateX(Math.PI/2);
    scene.add(gridHelper);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    var geometry = new THREE.PlaneBufferGeometry(1000, 1000);
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
        rollOverMesh.position.copy(intersect.point).add(intersect.face.normal);
        rollOverMesh.position.divideScalar(50).floor().multiplyScalar(50).addScalar(25);
    }
    render();
}

function onDocumentMouseDown(event) {
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
            voxel.position.copy(intersect.point).add(intersect.face.normal);
            voxel.position.divideScalar(50).floor().multiplyScalar(50).addScalar(25);
            voxel.name = "voxel";
            scene.add(voxel);
            console.log(voxel.position.clone().subScalar(25).divideScalar(50).toArray());

            objects.push(voxel);
        }
        render();
    }
}

function render() {
    renderer.render(scene, camera);
}