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
}

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
    scene.background = new THREE.Color(0xf0f0f0);

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

    // orbit controls

    var orbit = new THREE.OrbitControls(camera);
    orbit.damping = 0.2;
    orbit.addEventListener('change', render);

    // lights

    var ambientLight = new THREE.AmbientLight(0x707070);
    scene.add(ambientLight);

    var directionalLight = new THREE.DirectionalLight(0x909090);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    scene.add(directionalLight);

    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);
}

var camera, scene, renderer;
var plane;
var mouse, raycaster;
var rollOverMesh, rollOverMaterial;
var polycubeSystem;

var objects = [];

init();
polycubeSystem.addCube(new THREE.Vector3(), rules[0], 0);
polycubeSystem.processMoves();
render();

