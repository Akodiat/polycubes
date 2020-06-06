if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

// From: https://html-online.com/articles/get-url-parameters-javascript/
function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(
        /[?&]+([^=&]+)=([^&]*)/gi, 
        function(m,key,value) {vars[key] = value;}
    );
    return vars;
}

function getUrlParam(param, defaultVal) {
    var vars = getUrlVars();
    return param in vars ? vars[param] : defaultVal;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

// From https://github.com/mrdoob/three.js/pull/14526#issuecomment-497254491
function fitCamera(nSteps) {
    nSteps = nSteps || 100;
    const fitOffset = 1.3;
    const box = new THREE.Box3();
    box.expandByObject(polycubeSystem.cubeObjGroup);
    const size = box.getSize(new THREE.Vector3()).addScalar(1.5);
    const center = polycubeSystem.centerOfMass; //box.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);
    const direction = orbit.target.clone().sub(camera.position).normalize().multiplyScalar(distance);
    orbit.maxDistance = distance * 10;
    camera.near = distance / 100;
    camera.far = distance * 100;
    let targetPos = orbit.target.clone().sub(direction);

    let i = 1;
    let zoomOut = function() {
        // The tail is boring, so cut it off
        if (i/nSteps >= 0.5) {
            i = nSteps;
        }
        camera.position.lerp(targetPos, i/nSteps);

        let curr = camera.quaternion.clone();
        camera.lookAt(polycubeSystem.centerOfMass);
        let target = camera.quaternion.clone();
        camera.quaternion.copy(curr);
        camera.quaternion.slerp(target, i/nSteps)

        render();
        if(i < nSteps) {
            i++;
            requestAnimationFrame(zoomOut.bind(this));
        } else {
            orbit.target.copy(center);
        }
    }
    zoomOut();

}

// Regenerate when there are no more cubes to add
window.addEventListener('movesProcessed', function(e) {
    fitCamera();
}, false);


function render() {
    renderer.render(scene, camera);
}

function init() {
    camera = new THREE.PerspectiveCamera(
        45, window.innerWidth / window.innerHeight,
        1, 10000);
    camera.position.set(5, 8, 13);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // Parse rule
    var vars = getUrlVars();
    if ("hexRule" in vars) {
        rules = parseHexRule(vars["hexRule"]);
    } else {
        defaultRule = "[[1,1,1,1,1,1],[-1,0,0,0,0,0]]";
        rules = JSON.parse(getUrlParam("rules",defaultRule));
        
        // Replace rotation number with vector
        rules = rules.map(function(rule) {return rule.map(function(face, i) {
            var r = faceRotations[i].clone();
            if(typeof face == "number") {
                return {'c':face, 'd':r};
            } else {
                r.applyAxisAngle(ruleOrder[i], face[1]*Math.PI/2);
                return {'c':face[0], 'd':r};
            }
        });});
    }

    nMaxCubes = JSON.parse(getUrlParam("nMaxCubes",100));

    polycubeSystem = new PolycubeSystem(rules, ruleOrder, nMaxCubes);

    // lights

    var ambientLight = new THREE.AmbientLight(0x707070);
    camera.add(ambientLight);

    var directionalLight = new THREE.PointLight(0x909090);
    directionalLight.position.set(10, 10, 5).normalize();
    camera.add(directionalLight);

    scene.add(camera);

    canvas = document.getElementById("threeCanvas");
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: canvas,
        preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);

    // orbit controls

    orbit = new THREE.OrbitControls(camera, canvas);
    orbit.damping = 0.2;
    orbit.addEventListener('change', render);

    orbit.target = polycubeSystem.centerOfMass;
}

var camera, orbit, scene, renderer, canvas;
var plane;
var mouse, raycaster;
var rollOverMesh, rollOverMaterial;
var polycubeSystem;

var objects = [];

init();
polycubeSystem.addCube(new THREE.Vector3(), rules[0], 0);
polycubeSystem.processMoves();
render();

