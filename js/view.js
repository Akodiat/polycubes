if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

document.addEventListener("keydown", event => {
    if (event.key == 's' && event.ctrlKey) {
        event.preventDefault();
        system.getCoordinateFile();
    }
});

function getPatchySimFiles(hexRule, count=1) {
    let getPatchStr = (id, color, i, a2, strength=1)=>{
        let a1 = ruleOrder[i].clone();
        return [
            `patch_${id} = {`,
            `  id = ${id}`,
            `  color = ${color}`,
            `  strength = ${strength}`,
            `  position = ${a1.clone().divideScalar(2).toArray()}`,
            `  a1 = ${a1.toArray()}`,
            `  a2 = ${a2.toArray()}`,
            '}',''
        ].join('\n')
    }
    let getParticleStr = (typeID, patches)=>[
        `particle_${typeID} = {`,
        `  type = ${typeID}`,
        `  patches = ${patches}`,
        '}',''
    ].join('\n');

    let particlesStr = "";
    let patchesStr = "";

    let patchCounter = 0;
    let rule = parseHexRule(hexRule);
    rule.forEach((cubeType, typeID)=>{
        let patches = [];
        cubeType.forEach((patch, i)=>{
            if(patch.color != 0) {
                // Needs to be > 20 to not be self complementary
                let color = patch.color + 20 * Math.sign(patch.color);
                patchesStr += getPatchStr(patchCounter, color, i, patch.alignDir);
                patches.push(patchCounter);
                patchCounter++;
            }
        });
        particlesStr += getParticleStr(typeID, patches);
    });

    saveString(particlesStr, hexRule+'.particles.txt');
    saveString(patchesStr, hexRule+'.patches.txt');

    // If counts is a single integer, use that for all cube types
    if (typeof count[Symbol.iterator] !== 'function') {
        count = rule.map(c=>count);
    }
    if (count.length != rule.length) {
        console.warn(`If count is a list it needs to be the same length as the rule (${rule.length}), not ${count.length}`);
        return;
    }

    let total = 0;
    let top = [];
    count.forEach((c, typeID)=>{
        total+=c;
        for(let i=0; i<c; i++) {
            top.push(typeID);
        }
    });
    let topStr = `${total} ${rule.length}\n${top.join(' ')}`;

    saveString(topStr, hexRule+'.top');
}

function getCoordinateFile() {
    let filename = `${system.getRuleStr()}.${system.cubeMap.size}-mer`;
    let text = ""
    system.cubeMap.forEach(function(value, key){text += key + '\n'});
    saveString(text, filename);
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

function exportGLTF() {
    // Instantiate an exporter
    let exporter = new THREE.GLTFExporter();
    let options = {'forceIndices': true};

    // Parse the input and generate the glTF output
    exporter.parse(system.objGroup, function (result) {
        if (result instanceof ArrayBuffer) {
            saveArrayBuffer(result, 'scene.glb');
        } else {
            let output = JSON.stringify(result, null, 2);
            console.log(output);
            saveString(output, 'scene.gltf');
        }
    }, options);
}

function saveCanvasImage(){
    canvas.toBlob(function(blob){
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `${system.getRuleStr()}.png`;
        a.click();
    }, 'image/png', 1.0);
}

rulesToImage = [];
function getImagesFromRules(rules) {
    rulesToImage = rules;
    f = ()=>{
        saveCanvasImage();
        nextrule = rulesToImage.pop();
        if(nextrule){
            system.resetRule(parseHexRule(nextrule));
        }
    };
    window.addEventListener('movesProcessed', f, false);
    nextrule = rulesToImage.pop();
    system.resetRule(parseHexRule(nextrule));
}

function toggleModal(id) {
    let modal = document.getElementById(id);
    modal.classList.toggle("show-modal");
}

// From: https://html-online.com/articles/get-url-parameters-javascript/
function getUrlVars() {
    let vars = {};
    let parts = window.location.href.replace(
        /[?&]+([^=&]+)=([^&]*)/gi, 
        function(m,key,value) {vars[key] = value;}
    );
    return vars;
}

function getUrlParam(param, defaultVal) {
    let vars = getUrlVars();
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
    nSteps = nSteps || 20;
    const fitOffset = 1.3;
    const box = new THREE.Box3();
    box.expandByObject(system.objGroup);
    const size = box.getSize(new THREE.Vector3()).addScalar(1.5);
    const center = system.centerOfMass; //box.getCenter(new THREE.Vector3());
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
        camera.position.lerp(targetPos, Math.pow(i/nSteps,2));

        let curr = camera.quaternion.clone();
        camera.lookAt(system.centerOfMass);
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

function switchCamera() {
    if (camera instanceof THREE.PerspectiveCamera) {
        //get camera parameters
        const far = camera.far;
        const near = camera.near;
        const focus = orbit.target;
        const fov = camera.fov * Math.PI / 180; //convert to radians
        const pos = camera.position;
        let width = 2 * Math.tan(fov / 2) * focus.distanceTo(pos);
        let height = width / camera.aspect;
        const up = camera.up;
        const quat = camera.quaternion;
        let cameraHeading = new THREE.Vector3(0, 0, -1);
        cameraHeading.applyQuaternion(quat);
        //if the camera is upside down, you need to flip the corners of the orthographic box
        /*
        if (quat.dot(refQ) < 0 && quat.w > 0) {
            width *= -1;
            height *= -1;
        }
        */
        //create a new camera with same properties as old one
        const newCam = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, near, far);
        camera.position.clone(pos);
        newCam.up = up;
        newCam.lookAt(focus);
        camera.children.forEach(c => {
            newCam.add(c);
        });
        scene.remove(camera);
        camera = newCam;
        orbit.object = camera;
        scene.add(camera);
    }
    else if (camera instanceof THREE.OrthographicCamera) {
        //get camera parameters
        const far = camera.far;
        const near = camera.near;
        const focus = orbit.target;
        const pos = camera.position;
        const up = camera.up;
        let fov = 2 * Math.atan((((camera.right - camera.left) / 2)) / focus.distanceTo(pos)) * 180 / Math.PI;
        //if the camera is upside down, you need to flip the fov for the perspective camera
        if (camera.left > camera.right) {
            fov *= -1;
        }
        //create a new camera with same properties as old one
        let newCam = createPerspectiveCamera(fov, near, far, pos.toArray());
        newCam.up = up;
        newCam.lookAt(focus);
        let light = pointlight;
        scene.remove(camera);
        camera = newCam;
        orbit.object = camera;
        camera.add(light);
        scene.add(camera);
        document.getElementById("cameraSwitch").innerHTML = "Orthographic";
    }
    render();
}


function render() {
    renderer.render(scene, camera);
}

function initScene() {
    camera = new THREE.PerspectiveCamera(
        45, window.innerWidth / window.innerHeight,
        1, 10000);
    camera.position.set(5, 8, 13);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();

    // lights
    let ambientLight = new THREE.AmbientLight(0x707070);
    camera.add(ambientLight);

    let directionalLight = new THREE.PointLight(0x909090);
    directionalLight.position.set(10, 10, 5).normalize();
    camera.add(directionalLight);

    scene.add(camera);

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

    // orbit controls

    orbit = new THREE.OrbitControls(camera, canvas);
    orbit.damping = 0.2;
    orbit.addEventListener('change', render);
}

let camera, orbit, scene, renderer, canvas;
let plane;
let mouse, raycaster;
let rollOverMesh, rollOverMaterial;

//let objects = [];

initScene();


